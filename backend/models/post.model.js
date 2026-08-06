import mongoose from "mongoose";

// Optional single-choice poll attached to a post. Votes are stored as user id
// arrays per option — fine at current scale, but could grow large on viral
// posts (they ride along on every post fetch); revisit with counters if needed.
const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [
      {
        _id: false,
        text: { type: String, required: true },
        votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      },
    ],
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    caption: { type: String, default: "" },
    // For videos, `image` holds the Cloudinary-generated poster frame
    image: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    // Cloudinary video URL (mediaType === "video" only)
    video: { type: String },
    // AI-generated accessibility description (empty when AI is disabled)
    altText: { type: String, default: "" },
    // 768-dim semantic embedding for vector search — never sent in API
    // payloads by default (select: false)
    embedding: { type: [Number], select: false },
    // Lowercased #tags parsed from the caption (kept in sync on edits)
    hashtags: { type: [String], default: [] },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Stage 3 (MIGRATION.md): likes live exclusively in the Like collection
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment"
      }
    ],
    // Absent (undefined) when the post has no poll
    poll: { type: pollSchema, default: undefined },
  },
  { timestamps: true }
);

postSchema.index({ author: 1 });
postSchema.index({ hashtags: 1, _id: -1 });

export const Post = mongoose.model("Post", postSchema);
