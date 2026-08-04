import mongoose from "mongoose";

// Pending follow request to a private account. Accepting it creates the
// Follow edge (plus the dual-written arrays) and deletes the request.
const followRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

followRequestSchema.index({ from: 1, to: 1 }, { unique: true });
followRequestSchema.index({ to: 1 });

export const FollowRequest = mongoose.model("FollowRequest", followRequestSchema);
