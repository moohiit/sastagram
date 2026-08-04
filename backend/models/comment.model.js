import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true
  },
  // One-level threading: replies reference their top-level parent comment
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    default: null
  },
  // Comment like lists stay small — embedded array is fine at this scale
  // (API payloads expose likesCount/likedByMe, never the array)
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]
}, { timestamps: true });

commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ parent: 1 });

export const Comment = mongoose.model("Comment", commentSchema);