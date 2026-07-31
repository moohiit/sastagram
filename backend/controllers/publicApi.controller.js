import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { isAiEnabled, embedText } from "../utils/gemini.js";

// Public, unauthenticated read-only API (/api/public/v1).
//
// Every response goes through toPublicPost() so internal fields (likes arrays,
// embeddings, comment bodies, poll voter ids, emails, ...) can never leak —
// the mapper builds the payload field by field instead of stripping.

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;

// Shared mapper: works for populated mongoose docs and plain aggregate
// results alike. Only ever exposes counts, never the underlying id arrays.
export const toPublicPost = (post) => ({
  id: post._id.toString(),
  caption: post.caption ?? "",
  image: post.image,
  altText: post.altText ?? "",
  likeCount: Array.isArray(post.likes) ? post.likes.length : 0,
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

    return res.status(200).json({
      success: true,
      posts: posts.map(toPublicPost),
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
    return res.status(200).json({ success: true, post: toPublicPost(post) });
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
      "username bio profilePicture posts followers following"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      user: {
        username: user.username,
        bio: user.bio ?? "",
        profilePicture: user.profilePicture ?? "",
        counts: {
          posts: user.posts.length,
          followers: user.followers.length,
          following: user.following.length,
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
        return res.status(200).json({
          success: true,
          posts: posts.map(toPublicPost),
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
    return res.status(200).json({
      success: true,
      posts: posts.map(toPublicPost),
      mode: "text",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
