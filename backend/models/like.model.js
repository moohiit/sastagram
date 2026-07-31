import mongoose from "mongoose";

// One document per like: `user` liked `post`.
// Stage 1 of the social-graph migration (see MIGRATION.md): this collection is
// dual-written alongside Post.likes, which remains the authoritative source
// for reads until Stage 2.
const likeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  { timestamps: true }
);

// One like per (user, post) pair — upserts keep this idempotent.
likeSchema.index({ user: 1, post: 1 }, { unique: true });
// "Who liked this post?" / like counts per post.
likeSchema.index({ post: 1 });

export const Like = mongoose.model("Like", likeSchema);
