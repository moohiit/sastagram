import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    caption: { type: String, default: "" },
    image: { type: String, required: true },
    // AI-generated accessibility description (empty when AI is disabled)
    altText: { type: String, default: "" },
    // 768-dim semantic embedding for vector search — never sent in API
    // payloads by default (select: false)
    embedding: { type: [Number], select: false },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
      }
    ],
  },
  { timestamps: true }
);

postSchema.index({ author: 1 });

export const Post = mongoose.model("Post", postSchema);
