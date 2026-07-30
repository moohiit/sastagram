import sharp from "sharp";
import cloudinary from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { getRecieverSocketId, io } from "../socket.io/socket.io.js";

//Add new Post controller
export const addNewPost = async (req, res) => {
  try {
    const { caption } = req.body;
    const image = req.file;
    const authorId = req.id;
    if (!image) {
      return res.status(400).json({
        message: "Image required",
        success: true,
      });
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

// Get all Posts controller
export const getAllPost = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "author",
        select: "username profilePicture",
      })
      .populate({
        path: "comments",
        sort: { createdAt: -1 },
        populate: {
          path: "author",
          select: "username profilePicture",
        },
      });
    if (!posts) {
      return res.status(500).json({
        message: "Error fetching posts",
        success: false,
      });
    }
    return res.status(200).json({
      message: "Posts fetched successfully",
      success: true,
      posts,
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
        sort: { createdAt: -1 },
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
    //like logic
    await post.updateOne({ $addToSet: { likes: likerId } });
    await post.save();
    //Socket.io logic goes here for realtime effect
    const user = await User.findById(likerId).select("username profilePicture");
    const postOwnerId = post.author.toString();
    if (postOwnerId !== likerId) {
      //emit a notification
      const notification = {
        type: "like",
        userId: likerId,
        userDetails: user,
        postId,
        message: "Your post was liked",
      };
      const postOwnerSocketId = getRecieverSocketId(postOwnerId);
      io.to(postOwnerSocketId).emit("notification", notification);
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
    //Dislike logic
    await post.updateOne({ $pull: { likes: dislikerId } });
    await post.save();

    //Socket.io logic goes here for realtime effect
    const user = await User.findById(dislikerId).select(
      "username profilePicture"
    );
    const postOwnerId = post.author.toString();
    if (postOwnerId !== dislikerId) {
      //emit a notification
      const notification = {
        type: "dislike",
        userId: dislikerId,
        userDetails: user,
        postId,
        message: "Your post was disliked",
      };
      const postOwnerSocketId = getRecieverSocketId(postOwnerId);
      io.to(postOwnerSocketId).emit("notification", notification);
    }
    //end

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
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        message: "Comment required",
        success: false,
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

    //Socket.io logic goes here for realtime effect
    const user = await User.findById(commenterId).select(
      "username profilePicture"
    );
    const postOwnerId = post.author.toString();
    if (postOwnerId !== commenterId) {
      //emit a notification
      const notification = {
        type: "comment",
        userId: commenterId,
        userDetails: user,
        postId,
        message: text,
      };
      const postOwnerSocketId = getRecieverSocketId(postOwnerId);
      io.to(postOwnerSocketId).emit("notification", notification);
    }
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
