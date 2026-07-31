import mongoose from "mongoose";

// One document per follow edge: `follower` follows `following`.
// Stage 1 of the social-graph migration (see MIGRATION.md): this collection is
// dual-written alongside User.followers/User.following, which remain the
// authoritative source for reads until Stage 2.
const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// One edge per (follower, following) pair — upserts keep this idempotent.
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// "Who does X follow?" / "Who follows X?" lookups.
followSchema.index({ follower: 1 });
followSchema.index({ following: 1 });

export const Follow = mongoose.model("Follow", followSchema);
