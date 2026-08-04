import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { Follow } from "../models/follow.model.js";
import { isAiEnabled, embedText } from "../utils/gemini.js";

// Public, unauthenticated read-only API (/api/public/v1).
//
// Every response goes through toPublicPost() so internal fields (likes arrays,
// embeddings, comment bodies, poll voter ids, emails, ...) can never leak —
// the mapper builds the payload field by field instead of stripping.

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;

// Stage 2 (MIGRATION.md): like counts come from the Like collection, batched
// per page of posts.
const likeCountsFor = async (posts) => {
  const rows = await Like.aggregate([
    { $match: { post: { $in: posts.map((p) => p._id) } } },
    { $group: { _id: "$post", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.n]));
};

// Shared mapper: works for populated mongoose docs and plain aggregate
// results alike. Only ever exposes counts, never the underlying id arrays.
export const toPublicPost = (post, likeCounts) => ({
  id: post._id.toString(),
  caption: post.caption ?? "",
  image: post.image,
  altText: post.altText ?? "",
  likeCount: likeCounts?.get(post._id.toString()) ?? 0,
  commentCount: Array.isArray(post.comments) ? post.comments.length : 0,
  createdAt: post.createdAt,
  author: post.author
    ? {
        username: post.author.username,
        profilePicture: post.author.profilePicture ?? "",
      }
    : null,
});

// GET /api/public/v1/posts?cursor=<lastPostId>&limit=<n<=20>
// Cursor pagination mirrors getAllPost: _id-descending, fetch one extra row
// to learn whether another page exists.
export const listPublicPosts = async (req, res) => {
  try {
    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_LIMIT,
      MAX_LIMIT
    );
    const { cursor } = req.query;
    if (cursor && !mongoose.isValidObjectId(cursor)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid cursor" });
    }
    const query = cursor ? { _id: { $lt: cursor } } : {};

    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select("caption image altText likes comments createdAt author")
      .populate({ path: "author", select: "username profilePicture" });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    const likeCounts = await likeCountsFor(posts);
    return res.status(200).json({
      success: true,
      posts: posts.map((p) => toPublicPost(p, likeCounts)),
      nextCursor: hasMore ? posts[posts.length - 1]._id : null,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// GET /api/public/v1/posts/:id — single post, same public shape.
export const getPublicPost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    const post = await Post.findById(id)
      .select("caption image altText likes comments createdAt author")
      .populate({ path: "author", select: "username profilePicture" });
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    const likeCounts = await likeCountsFor([post]);
    return res
      .status(200)
      .json({ success: true, post: toPublicPost(post, likeCounts) });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// GET /api/public/v1/users/:username — public profile with counts only.
export const getPublicUser = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select(
      "username bio profilePicture posts"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // Stage 2: follower counts from the Follow collection
    const [followers, following] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id }),
    ]);
    return res.status(200).json({
      success: true,
      user: {
        username: user.username,
        bio: user.bio ?? "",
        profilePicture: user.profilePicture ?? "",
        counts: {
          posts: user.posts.length,
          followers,
          following,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// GET /api/public/v1/search/posts?q= — same strategy as the app's
// searchPosts: semantic ($vectorSearch) when AI is enabled, otherwise a
// case-insensitive caption-regex fallback. Results are mapped to the public
// shape and the mode ("semantic" | "text") is reported.
export const searchPublicPosts = async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) {
      return res.status(200).json({ success: true, posts: [], mode: "text" });
    }

    if (isAiEnabled()) {
      try {
        const queryVector = await embedText(q);
        const posts = await Post.aggregate([
          {
            $vectorSearch: {
              index: "post_embedding_index",
              path: "embedding",
              queryVector,
              numCandidates: 100,
              limit: MAX_LIMIT,
            },
          },
          { $project: { embedding: 0 } },
          {
            $lookup: {
              from: "users",
              localField: "author",
              foreignField: "_id",
              as: "author",
              pipeline: [{ $project: { username: 1, profilePicture: 1 } }],
            },
          },
          { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        ]);
        const likeCounts = await likeCountsFor(posts);
        return res.status(200).json({
          success: true,
          posts: posts.map((p) => toPublicPost(p, likeCounts)),
          mode: "semantic",
        });
      } catch (error) {
        // Fall through to text search (e.g. no Atlas vector index, API error)
        console.error("Semantic search failed, falling back to text:", error.message);
      }
    }

    // Fallback: case-insensitive caption substring search, newest first
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const posts = await Post.find({ caption: { $regex: safe, $options: "i" } })
      .sort({ _id: -1 })
      .limit(MAX_LIMIT)
      .select("caption image altText likes comments createdAt author")
      .populate({ path: "author", select: "username profilePicture" });
    const likeCounts = await likeCountsFor(posts);
    return res.status(200).json({
      success: true,
      posts: posts.map((p) => toPublicPost(p, likeCounts)),
      mode: "text",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
