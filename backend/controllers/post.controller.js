import mongoose from "mongoose";
import sharp from "sharp";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Follow } from "../models/follow.model.js";
import { Notification } from "../models/notification.model.js";
import { notify } from "../utils/notify.js";
import { isToxicComment } from "../utils/moderation.js";
import { extractHashtags, notifyMentions } from "../utils/textEntities.js";
import { enrichPostAI } from "../utils/postAI.js";
import { isAiEnabled, embedText } from "../utils/gemini.js";
import { io } from "../socket.io/socket.io.js";

const POLL_QUESTION_MAX = 150;
const POLL_OPTION_MAX = 80;

// Private-account gating for feeds: returns the author ids whose posts this
// viewer must NOT see (private accounts they don't follow), or null when
// nothing needs excluding. Private accounts are assumed to be a small set.
const hiddenAuthorIds = async (viewerId) => {
  const privateUsers = await User.find({ isPrivate: true }).select("_id").lean();
  if (!privateUsers.length) return null;
  const allowed = new Set(viewerId ? [viewerId.toString()] : []);
  if (viewerId) {
    const edges = await Follow.find({
      follower: viewerId,
      following: { $in: privateUsers.map((u) => u._id) },
    })
      .select("following")
      .lean();
    for (const e of edges) allowed.add(e.following.toString());
  }
  const excluded = privateUsers
    .map((u) => u._id)
    .filter((id) => !allowed.has(id.toString()));
  return excluded.length ? excluded : null;
};

// May this viewer see posts from `author`? (author may be a doc or an id)
export const canViewAuthor = async (authorId, viewerId) => {
  const author = await User.findById(authorId).select("isPrivate");
  if (!author?.isPrivate) return true;
  if (viewerId && viewerId.toString() === authorId.toString()) return true;
  if (!viewerId) return false;
  return Boolean(await Follow.exists({ follower: viewerId, following: authorId }));
};

// Stage 2 (MIGRATION.md): like reads come from the Like collection. Replaces
// each post's embedded likes array with likesCount + likedByMe, batched per
// page. Works on mongoose docs and plain aggregate results alike.
const attachLikeInfo = async (posts, viewerId) => {
  const ids = posts.map((p) => p._id);
  const [countRows, mine] = await Promise.all([
    Like.aggregate([
      { $match: { post: { $in: ids } } },
      { $group: { _id: "$post", n: { $sum: 1 } } },
    ]),
    viewerId
      ? Like.find({ user: viewerId, post: { $in: ids } }).select("post").lean()
      : [],
  ]);
  const countMap = new Map(countRows.map((r) => [r._id.toString(), r.n]));
  const mineSet = new Set(mine.map((l) => l.post.toString()));
  return posts.map((p) => {
    const obj = typeof p.toObject === "function" ? p.toObject() : { ...p };
    delete obj.likes;
    obj.likesCount = countMap.get(p._id.toString()) || 0;
    obj.likedByMe = mineSet.has(p._id.toString());
    return obj;
  });
};

// Parse + validate the optional poll fields from a multipart body.
// Returns { poll } (undefined when no poll was sent) or { error } for a 400.
const parsePollInput = (pollQuestion, pollOptions) => {
  if (pollQuestion === undefined && pollOptions === undefined) return {};
  const question = (pollQuestion || "").toString().trim();
  if (!question || question.length > POLL_QUESTION_MAX) {
    return { error: `Poll question is required (max ${POLL_QUESTION_MAX} characters)` };
  }
  let options;
  try {
    options = JSON.parse(pollOptions);
  } catch {
    return { error: "Poll options must be a JSON array" };
  }
  if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
    return { error: "Poll needs 2 to 4 options" };
  }
  const texts = options.map((o) => (typeof o === "string" ? o.trim() : ""));
  if (texts.some((t) => !t || t.length > POLL_OPTION_MAX)) {
    return { error: `Each poll option must be non-empty (max ${POLL_OPTION_MAX} characters)` };
  }
  return { poll: { question, options: texts.map((text) => ({ text, votes: [] })) } };
};

//Add new Post controller
export const addNewPost = async (req, res) => {
  try {
    const { caption, pollQuestion, pollOptions } = req.body;
    const image = req.file;
    const authorId = req.id;
    if (!image) {
      return res.status(400).json({
        message: "Image required",
        success: false,
      });
    }
    // Validate the optional poll before any upload work
    const { poll, error: pollError } = parsePollInput(pollQuestion, pollOptions);
    if (pollError) {
      return res.status(400).json({ message: pollError, success: false });
    }
    const optimizedImageBuffer = await sharp(image.buffer)
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
      })
      .toFormat("jpeg", { quality: 80 })
      .toBuffer();
    // Image to data uri
    const imageUri = `data:${
      image.mimetype
    };base64,${optimizedImageBuffer.toString("base64")}`;
    //upload image to cloudinary
    const cloudResponse = await cloudinary.uploader.upload(imageUri);
    if (!cloudResponse) {
      return res.status(500).json({
        message: "Error uploading image to cloudinary",
        success: false,
      });
    }
    const imageUrl = cloudResponse.secure_url;
    //creating the post
    const post = await Post.create({
      caption,
      image: imageUrl,
      author: authorId,
      hashtags: extractHashtags(caption),
      poll,
    });
    if (!post) {
      return res.status(500).json({
        message: "Error creating post",
        success: false,
      });
    }
    // Atomic $push — a concurrent deletePost's update can't clobber this
    await User.updateOne({ _id: authorId }, { $push: { posts: post._id } });

    // Fire-and-forget @mention notifications from the caption
    notifyMentions({ text: caption, sender: authorId, post: post._id });

    // Fire-and-forget AI enrichment (alt-text + embedding) — deliberately not
    // awaited so upload response time is unchanged; no-op when AI is disabled.
    enrichPostAI(post._id, optimizedImageBuffer, "image/jpeg", caption);

    //populate the post with user data
    await post.populate({
      path: "author",
      select: "-password",
    });
    return res.status(201).json({
      message: "Post created successfully",
      success: true,
      post,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/v1/post/search?q= — semantic search over post embeddings (Atlas
// $vectorSearch) with a plain caption-regex fallback whenever AI is disabled
// or anything in the semantic path fails.

// Get all Posts controller — cursor-paginated (?cursor=<lastPostId>&limit=10)
export const getAllPost = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    const { cursor } = req.query;
    if (cursor && !mongoose.isValidObjectId(cursor)) {
      return res.status(400).json({ success: false, message: "Invalid cursor" });
    }
    const query = cursor ? { _id: { $lt: cursor } } : {};
    const hidden = await hiddenAuthorIds(req.id);
    if (hidden) query.author = { $nin: hidden };

    // Fetch one extra to know whether another page exists. Comments are a
    // capped preview — the full thread is fetched on demand via
    // GET /:id/comment/all (a post with thousands of comments used to make
    // every feed page pull all of them).
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select("-embedding")
      .populate({
        path: "author",
        select: "username profilePicture",
      })
      .populate({
        path: "comments",
        select: "-likes",
        options: { sort: { createdAt: -1 }, perDocumentLimit: 3 },
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    // True comment totals (the populated array above is capped)
    const countRows = await Comment.aggregate([
      { $match: { post: { $in: posts.map((p) => p._id) } } },
      { $group: { _id: "$post", n: { $sum: 1 } } },
    ]);
    const countMap = new Map(countRows.map((r) => [r._id.toString(), r.n]));
    const payload = (await attachLikeInfo(posts, req.id)).map((obj) => {
      obj.commentsCount = countMap.get(obj._id.toString()) || 0;
      return obj;
    });

    return res.status(200).json({
      message: "Posts fetched successfully",
      success: true,
      posts: payload,
      nextCursor: hasMore ? payload[payload.length - 1]._id : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Get user posts — cursor-paginated (?cursor=<lastPostId>&limit=30)
export const getUserPost = async (req, res) => {
  try {
    const authorId = req.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { cursor } = req.query;
    if (cursor && !mongoose.isValidObjectId(cursor)) {
      return res.status(400).json({ success: false, message: "Invalid cursor" });
    }
    const query = { author: authorId };
    if (cursor) query._id = { $lt: cursor };
    const userPosts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select("-embedding")
      .populate({
        path: "author",
        select: "username profilePicture",
      });
    const hasMore = userPosts.length > limit;
    if (hasMore) userPosts.pop();
    const payload = await attachLikeInfo(userPosts, req.id);
    return res.status(200).json({
      message: "Posts fetched successfully",
      success: true,
      posts: payload,
      nextCursor: hasMore ? payload[payload.length - 1]._id : null,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET /api/v1/post/explore — engagement-ranked feed. Score is a classic
// gravity formula over the Stage-2 edge collections:
//   (3·likes + 2·comments + 1) / (ageHours + 2)^1.5
// Candidate pool is the newest 500 visible posts, so ranking stays cheap.
export const getExplorePosts = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 60);
    const match = {};
    const hidden = await hiddenAuthorIds(req.id);
    if (hidden) match.author = { $nin: hidden };

    const posts = await Post.aggregate([
      { $match: match },
      { $sort: { _id: -1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "post",
          as: "likeDocs",
          pipeline: [{ $count: "n" }],
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "post",
          as: "commentDocs",
          pipeline: [{ $count: "n" }],
        },
      },
      {
        $addFields: {
          likesCount: { $ifNull: [{ $arrayElemAt: ["$likeDocs.n", 0] }, 0] },
          commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentDocs.n", 0] }, 0] },
          ageHours: {
            $divide: [{ $subtract: ["$$NOW", "$createdAt"] }, 3600000],
          },
        },
      },
      {
        $addFields: {
          score: {
            $divide: [
              {
                $add: [
                  { $multiply: ["$likesCount", 3] },
                  { $multiply: ["$commentsCount", 2] },
                  1,
                ],
              },
              { $pow: [{ $add: ["$ageHours", 2] }, 1.5] },
            ],
          },
        },
      },
      { $sort: { score: -1, _id: -1 } },
      { $limit: limit },
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
      { $project: { embedding: 0, likes: 0, likeDocs: 0, commentDocs: 0, comments: 0 } },
    ]);

    // likedByMe for the viewer (counts already computed above)
    const mine = req.id
      ? await Like.find({ user: req.id, post: { $in: posts.map((p) => p._id) } })
          .select("post")
          .lean()
      : [];
    const mineSet = new Set(mine.map((l) => l.post.toString()));
    for (const p of posts) p.likedByMe = mineSet.has(p._id.toString());

    return res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/post/tags/:tag — cursor-paginated posts carrying a hashtag
export const getPostsByHashtag = async (req, res) => {
  try {
    const tag = (req.params.tag || "").toLowerCase();
    if (!/^[\p{L}\p{N}_]{1,50}$/u.test(tag)) {
      return res.status(400).json({ success: false, message: "Invalid hashtag" });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { cursor } = req.query;
    if (cursor && !mongoose.isValidObjectId(cursor)) {
      return res.status(400).json({ success: false, message: "Invalid cursor" });
    }
    const query = { hashtags: tag };
    if (cursor) query._id = { $lt: cursor };
    const hidden = await hiddenAuthorIds(req.id);
    if (hidden) query.author = { $nin: hidden };
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select("-embedding")
      .populate({ path: "author", select: "username profilePicture" });
    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();
    const payload = await attachLikeInfo(posts, req.id);
    return res.status(200).json({
      success: true,
      posts: payload,
      nextCursor: hasMore ? payload[payload.length - 1]._id : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/post/:id/similar — related posts for the detail page.
// Vector search over embeddings when AI is enabled; falls back to
// shared-hashtag posts, then the author's recent posts. Privacy-gated.
export const getSimilarPosts = async (req, res) => {
  try {
    const postId = req.params.id;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    const post = await Post.findById(postId).select("+embedding hashtags author");
    if (!post || !(await canViewAuthor(post.author, req.id))) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const hidden = await hiddenAuthorIds(req.id);
    const hiddenSet = hidden ? new Set(hidden.map((id) => id.toString())) : null;
    const visible = (posts) =>
      posts.filter(
        (p) =>
          p._id.toString() !== postId &&
          !hiddenSet?.has((p.author?._id ?? p.author).toString())
      );

    let similar = [];
    if (isAiEnabled() && Array.isArray(post.embedding) && post.embedding.length) {
      try {
        similar = visible(
          await Post.aggregate([
            {
              $vectorSearch: {
                index: "post_embedding_index",
                path: "embedding",
                queryVector: post.embedding,
                numCandidates: 50,
                limit: 8,
              },
            },
            { $project: { image: 1, caption: 1, altText: 1, author: 1 } },
          ])
        );
      } catch (error) {
        console.error("Similar-posts vector search failed:", error.message);
      }
    }
    if (similar.length === 0 && post.hashtags?.length) {
      similar = visible(
        await Post.find({ hashtags: { $in: post.hashtags } })
          .sort({ _id: -1 })
          .limit(8)
          .select("image caption altText author")
          .lean()
      );
    }
    if (similar.length === 0) {
      similar = visible(
        await Post.find({ author: post.author })
          .sort({ _id: -1 })
          .limit(8)
          .select("image caption altText author")
          .lean()
      );
    }
    return res.status(200).json({
      success: true,
      posts: similar.slice(0, 6).map((p) => ({
        _id: p._id,
        image: p.image,
        caption: p.caption,
        altText: p.altText,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/post/:id — single post (deep links / shared URLs)
export const getPostById = async (req, res) => {
  try {
    const postId = req.params.id;
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: "Invalid post id" });
    }
    const post = await Post.findById(postId)
      .select("-embedding")
      .populate({ path: "author", select: "username profilePicture" })
      .populate({
        path: "comments",
        options: { sort: { createdAt: -1 } },
        populate: { path: "author", select: "username profilePicture" },
      });
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    // Private authors are only visible to themselves and their followers
    if (!(await canViewAuthor(post.author._id, req.id))) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }
    const [payload] = await attachLikeInfo([post], req.id);
    return res.status(200).json({ success: true, post: payload });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

//Like post controller
export const likePost = async (req, res) => {
  try {
    const likerId = req.id;
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        message: "Post not Found",
        success: false,
      });
    }
    // Stage 3 (MIGRATION.md): the Like collection is the only store. The
    // upsert is idempotent, and upsertedCount tells us whether this request
    // actually created the like — so re-likes can't spam the author with
    // duplicate notifications.
    const likeResult = await Like.updateOne(
      { user: likerId, post: postId },
      { $setOnInsert: { user: likerId, post: postId } },
      { upsert: true }
    );
    if (likeResult.upsertedCount > 0) {
      // Persisted + realtime notification (offline users see it on next login)
      await notify({
        recipient: post.author,
        sender: likerId,
        type: "like",
        post: postId,
        text: "liked your post",
      });
    }

    //return response
    return res.status(200).json({
      message: "Post liked succesfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Dislike post controller
export const dislikePost = async (req, res) => {
  try {
    const dislikerId = req.id;
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        message: "Post not Found",
        success: false,
      });
    }
    // Stage 3 (MIGRATION.md): delete the Like edge — the collection is the
    // only store. Unliking is not a notification-worthy event.
    await Like.deleteOne({ user: dislikerId, post: postId });

    return res.status(200).json({
      message: "Post disliked succesfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//add post Comment on post controller
export const addComment = async (req, res) => {
  try {
    const commenterId = req.id;
    const postId = req.params.id;
    const { text, force, parentId } = req.body;

    if (!text) {
      return res.status(400).json({
        message: "Comment required",
        success: false,
      });
    }
    // One-level threading: a reply to a reply attaches to the top-level parent
    let parent = null;
    if (parentId) {
      if (!mongoose.isValidObjectId(parentId)) {
        return res.status(400).json({ message: "Invalid parent comment", success: false });
      }
      parent = await Comment.findById(parentId);
      if (!parent || parent.post.toString() !== postId) {
        return res.status(404).json({ message: "Parent comment not found", success: false });
      }
      if (parent.parent) parent = await Comment.findById(parent.parent);
    }

    // Soft moderation: flag potentially hurtful comments once; the client may
    // resend with force=true to post anyway. Fails open on AI errors.
    if (!force && (await isToxicComment(text))) {
      return res.status(200).json({
        success: false,
        flagged: true,
        message: "This comment may be hurtful",
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        message: "Post not Found",
        success: false,
      });
    }

    const comment = await Comment.create({
      text,
      author: commenterId,
      post: postId,
      parent: parent?._id || null,
    });

    const populatedComment = await comment.populate({
      path: "author",
      select: "username profilePicture",
    });

    await Post.updateOne({ _id: postId }, { $push: { comments: comment._id } });

    // Persisted + realtime notifications: post author, replied-to author,
    // and any @mentions
    await notify({
      recipient: post.author,
      sender: commenterId,
      type: "comment",
      post: postId,
      text,
    });
    if (parent && parent.author.toString() !== post.author.toString()) {
      await notify({
        recipient: parent.author,
        sender: commenterId,
        type: "comment",
        post: postId,
        text: `replied: ${text}`,
      });
    }
    notifyMentions({ text, sender: commenterId, post: postId });

    const payload = populatedComment.toObject();
    delete payload.likes;
    payload.likesCount = 0;
    payload.likedByMe = false;
    return res.status(201).json({
      message: "Comment added successfully",
      success: true,
      comment: payload,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Get comments of a post controller
export const getPostComments = async (req, res) => {
  try {
    const postId = req.params.id;
    const comments = await Comment.find({ post: postId }).populate({
      path: "author",
      select: "username profilePicture",
    });
    if (!comments) {
      return res.status(404).json({
        message: "Comments not found",
        success: false,
      });
    }

    // Expose like counts/flags, never the id arrays
    const shaped = comments.map((c) => {
      const obj = c.toObject();
      obj.likesCount = c.likes?.length || 0;
      obj.likedByMe = req.id
        ? Boolean(c.likes?.some((id) => id.toString() === req.id))
        : false;
      delete obj.likes;
      return obj;
    });

    //return the response
    return res.status(200).json({
      message: "Comments fetched successfully",
      success: true,
      comments: shaped,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete a post controller
export const deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const authorId = req.id;
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
        success: false,
      });
    }
    //check if the logged in user is the author of the post
    if (post.author.toString() !== authorId) {
      return res.status(403).json({
        message: "You are not authorized to delete this post",
        success: false,
      });
    }

    //delete the post
    await Post.findByIdAndDelete(postId);

    // Delete the image from Cloudinary (public_id = last URL segment sans extension)
    try {
      const publicId = post.image.split("/").pop().split(".")[0];
      if (publicId) await cloudinary.uploader.destroy(publicId);
    } catch (e) {
      console.error("Cloudinary cleanup failed:", e.message);
    }

    //now also remove post id from user post (atomic — a concurrent addNewPost
    //$push can't be clobbered by a whole-array $set)
    await User.updateOne({ _id: authorId }, { $pull: { posts: post._id } });
    //delete the associated comments
    await Comment.deleteMany({ post: postId });
    //clean up everything else that references the post: Like edges (Stage-2
    //migration reads would double-count orphans), notifications about it, and
    //other users' bookmarks (orphans populate as null on their profiles)
    await Promise.all([
      Like.deleteMany({ post: post._id }).catch((e) =>
        console.error("Like cleanup failed:", e.message)
      ),
      Notification.deleteMany({ post: post._id }).catch((e) =>
        console.error("Notification cleanup failed:", e.message)
      ),
      User.updateMany(
        { bookmarks: post._id },
        { $pull: { bookmarks: post._id } }
      ).catch((e) => console.error("Bookmark cleanup failed:", e.message)),
    ]);

    //return response
    return res.status(200).json({
      message: "Post deleted successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Error deleting post",
      success: false,
    });
  }
};

// Bookmark a post controller
export const bookmarkPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        message: "Post not found",
        success: false,
      });
    }
    // Toggle atomically — $addToSet's modifiedCount says whether it was
    // added; if not, it was already bookmarked and we remove it. No
    // read-modify-write, so concurrent requests can't clobber the array.
    const added = await User.updateOne(
      { _id: userId },
      { $addToSet: { bookmarks: post._id } },
      { timestamps: false }
    );
    if (added.modifiedCount > 0) {
      return res.status(200).json({
        type: "saved",
        message: "Post bookmarked successfully",
        success: true,
      });
    }
    await User.updateOne({ _id: userId }, { $pull: { bookmarks: post._id } });
    return res.status(200).json({
      type: "unsaved",
      message: "Post unbookmarked successfully",
      success: true,
    });
  } catch (error) {
    console.log("Error");
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Edit a post caption controller (author only)
export const editPostCaption = async (req, res) => {
  try {
    const { caption } = req.body;
    if (typeof caption !== "string") {
      return res.status(400).json({ message: "Caption must be a string", success: false });
    }
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found", success: false });
    }
    if (post.author.toString() !== req.id) {
      return res.status(403).json({ message: "You are not authorized to edit this post", success: false });
    }
    post.caption = caption.trim();
    post.hashtags = extractHashtags(post.caption);
    await post.save();
    return res.status(200).json({ message: "Caption updated", success: true, post });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Delete a comment controller (comment author or post owner)
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found", success: false });
    }
    const post = await Post.findById(comment.post);
    const isCommentAuthor = comment.author.toString() === req.id;
    const isPostOwner = post && post.author.toString() === req.id;
    if (!isCommentAuthor && !isPostOwner) {
      return res.status(403).json({ message: "You are not authorized to delete this comment", success: false });
    }
    // Delete the comment plus its replies, and detach all of them from the post
    const replies = await Comment.find({ parent: comment._id }).select("_id");
    const removedIds = [comment._id, ...replies.map((r) => r._id)];
    await Comment.deleteMany({ _id: { $in: removedIds } });
    if (post) {
      await post.updateOne({ $pull: { comments: { $in: removedIds } } });
    }
    return res.status(200).json({
      message: "Comment deleted",
      success: true,
      commentId: comment._id,
      removedIds,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Toggle a like on a comment (POST /comment/:commentId/like)
export const toggleCommentLike = async (req, res) => {
  try {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ success: false, message: "Invalid comment id" });
    }
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found" });
    }
    // Atomic toggle: try to add; if nothing changed it was already liked.
    // timestamps:false so the automatic updatedAt $set can't fake a change.
    const added = await Comment.updateOne(
      { _id: commentId },
      { $addToSet: { likes: req.id } },
      { timestamps: false }
    );
    const liked = added.modifiedCount > 0;
    if (!liked) {
      await Comment.updateOne({ _id: commentId }, { $pull: { likes: req.id } });
    } else {
      await notify({
        recipient: comment.author,
        sender: req.id,
        type: "like",
        post: comment.post,
        text: "liked your comment",
      });
    }
    const fresh = await Comment.findById(commentId).select("likes");
    return res.status(200).json({
      success: true,
      liked,
      likesCount: fresh?.likes?.length || 0,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Vote on a post's poll (single-choice, changeable). Removes the voter from
// every option, then adds them to the chosen one — two atomic updateOne ops.
// Broadcasts "pollUpdate" to everyone (counts are public data).
export const votePoll = async (req, res) => {
  try {
    const postId = req.params.id;
    const voterId = req.id;
    const { optionIndex } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found", success: false });
    }
    if (!post.poll) {
      return res.status(400).json({ message: "This post has no poll", success: false });
    }
    const index = Number(optionIndex);
    if (!Number.isInteger(index) || index < 0 || index >= post.poll.options.length) {
      return res.status(400).json({ message: "Invalid poll option", success: false });
    }

    // Single pipeline update: remove the voter from every option and add them
    // to the chosen one in one atomic write, so a concurrent vote can't land
    // between the pull and the add (which could drop a vote entirely).
    const voterObjectId = new mongoose.Types.ObjectId(voterId);
    await Post.updateOne({ _id: postId, poll: { $exists: true } }, [
      {
        $set: {
          "poll.options": {
            $map: {
              input: { $range: [0, { $size: "$poll.options" }] },
              as: "i",
              in: {
                $let: {
                  vars: { opt: { $arrayElemAt: ["$poll.options", "$$i"] } },
                  in: {
                    _id: "$$opt._id",
                    text: "$$opt.text",
                    votes: {
                      $cond: [
                        { $eq: ["$$i", index] },
                        { $setUnion: ["$$opt.votes", [voterObjectId]] },
                        { $setDifference: ["$$opt.votes", [voterObjectId]] },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    const updated = await Post.findById(postId).select("poll");
    const counts = updated.poll.options.map((o) => o.votes.length);
    const totalVotes = counts.reduce((sum, n) => sum + n, 0);

    io.emit("pollUpdate", { postId, counts, totalVotes });

    return res.status(200).json({
      message: "Vote recorded",
      success: true,
      counts,
      totalVotes,
      userOption: index,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const searchPosts = async (req, res) => {
  try {
    const q = (req.query.q || "").toString().trim();
    if (!q) {
      return res.status(200).json({ success: true, posts: [], mode: "text" });
    }
    const hidden = await hiddenAuthorIds(req.id);
    const hiddenSet = hidden ? new Set(hidden.map((id) => id.toString())) : null;

    if (isAiEnabled()) {
      try {
        const queryVector = await embedText(q);
        let posts = await Post.aggregate([
          {
            $vectorSearch: {
              index: "post_embedding_index",
              path: "embedding",
              queryVector,
              numCandidates: 100,
              limit: 20,
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
        if (hiddenSet) {
          posts = posts.filter((p) => !hiddenSet.has(p.author?._id?.toString()));
        }
        return res.status(200).json({
          success: true,
          posts: await attachLikeInfo(posts, req.id),
          mode: "semantic",
        });
      } catch (error) {
        // Fall through to text search (e.g. no Atlas vector index, API error)
        console.error("Semantic search failed, falling back to text:", error.message);
      }
    }

    // Fallback: case-insensitive caption substring search, newest first
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const textQuery = { caption: { $regex: safe, $options: "i" } };
    if (hidden) textQuery.author = { $nin: hidden };
    const posts = await Post.find(textQuery)
      .sort({ _id: -1 })
      .limit(20)
      .select("-embedding")
      .populate({ path: "author", select: "username profilePicture" });
    return res.status(200).json({
      success: true,
      posts: await attachLikeInfo(posts, req.id),
      mode: "text",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
