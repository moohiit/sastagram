import sharp from "sharp";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { notify } from "../utils/notify.js";
import { isToxicComment } from "../utils/moderation.js";
import { enrichPostAI } from "../utils/postAI.js";
import { isAiEnabled, embedText } from "../utils/gemini.js";
import { io } from "../socket.io/socket.io.js";

const POLL_QUESTION_MAX = 150;
const POLL_OPTION_MAX = 80;

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
        success: true,
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
      poll,
    });
    if (!post) {
      return res.status(500).json({
        message: "Error creating post",
        success: false,
      });
    }
    //Update the user posts
    const user = await User.findById(authorId);
    if (!user) {
      return res.status(500).json({
        message: "Error finding user",
        success: false,
      });
    }
    user.posts.push(post._id);
    await user.save();

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
    const query = cursor ? { _id: { $lt: cursor } } : {};

    // Fetch one extra to know whether another page exists
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({
        path: "author",
        select: "username profilePicture",
      })
      .populate({
        path: "comments",
        options: { sort: { createdAt: -1 } },
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      });

    const hasMore = posts.length > limit;
    if (hasMore) posts.pop();

    return res.status(200).json({
      message: "Posts fetched successfully",
      success: true,
      posts,
      nextCursor: hasMore ? posts[posts.length - 1]._id : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//Get user posts
export const getUserPost = async (req, res) => {
  try {
    const authorId = req.id;
    const userPosts = await Post.find({ author: authorId })
      .sort({ createdAt: -1 })
      .populate({
        path: "author",
        select: "username profilePicture",
      })
      .populate({
        path: "comments",
        options: { sort: { createdAt: -1 } },
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      });
    if (!userPosts) {
      return res.status(500).json({
        message: "Error fetching posts",
        success: false,
      });
    }
    return res.status(200).json({
      message: "Posts fetched successfully",
      success: true,
      posts: userPosts,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
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
    //like logic (atomic — no extra save needed)
    await post.updateOne({ $addToSet: { likes: likerId } });
    // Persisted + realtime notification (offline users see it on next login)
    await notify({
      recipient: post.author,
      sender: likerId,
      type: "like",
      post: postId,
      text: "liked your post",
    });

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
    //Dislike logic (atomic — no extra save needed). Unliking a post is not a
    //notification-worthy event — no notification is sent.
    await post.updateOne({ $pull: { likes: dislikerId } });

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
    const { text, force } = req.body;

    if (!text) {
      return res.status(400).json({
        message: "Comment required",
        success: false,
      });
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
    });

    const populatedComment = await comment.populate({
      path: "author",
      select: "username profilePicture",
    });

    post.comments.push(comment._id);
    await post.save();

    // Persisted + realtime notification
    await notify({
      recipient: post.author,
      sender: commenterId,
      type: "comment",
      post: postId,
      text,
    });
    return res.status(201).json({
      message: "Comment added successfully",
      success: true,
      comment: populatedComment,
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

    //return the response
    return res.status(200).json({
      message: "Comments fetched successfully",
      success: true,
      comments,
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

    //now also remove post id from user post
    let user = await User.findById(authorId);
    user.posts = user.posts.filter((id) => id.toString() !== postId);
    await user.save();
    //delete the associated comments
    await Comment.deleteMany({ post: postId });

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
    const user = await User.findById(userId);
    if (user.bookmarks.includes(post._id)) {
      //already bokmarked -> remove bookmark
      user.bookmarks.pull(post._id);
      await user.save();
      // console.log("Post UnBookmarked");

      return res.status(200).json({
        type: "unsaved",
        message: "Post unbookmarked successfully",
        success: true,
      });
    } else {
      // Bookmark the post
      //method1
      user.bookmarks.push(post._id);
      //method2
      // user.updateOne({$addToSet:{bookmarks:post._id}})
      await user.save();
      // console.log("Post Bookmarked");

      return res.status(200).json({
        type: "saved",
        message: "Post bookmarked successfully",
        success: true,
      });
    }
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
    await Comment.findByIdAndDelete(comment._id);
    if (post) {
      await post.updateOne({ $pull: { comments: comment._id } });
    }
    return res.status(200).json({ message: "Comment deleted", success: true, commentId: comment._id });
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

    // Remove any previous vote across all options, then add the new one
    await Post.updateOne(
      { _id: postId },
      { $pull: { "poll.options.$[].votes": voterId } }
    );
    await Post.updateOne(
      { _id: postId },
      { $addToSet: { [`poll.options.${index}.votes`]: voterId } }
    );

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
        return res.status(200).json({ success: true, posts, mode: "semantic" });
      } catch (error) {
        // Fall through to text search (e.g. no Atlas vector index, API error)
        console.error("Semantic search failed, falling back to text:", error.message);
      }
    }

    // Fallback: case-insensitive caption substring search, newest first
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const posts = await Post.find({ caption: { $regex: safe, $options: "i" } })
      .sort({ _id: -1 })
      .limit(20)
      .populate({ path: "author", select: "username profilePicture" });
    return res.status(200).json({ success: true, posts, mode: "text" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
