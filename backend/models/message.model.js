import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recieverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
    },
    // Optional shared post ("share to DM"); a message must carry text, a
    // post, or both — enforced by the pre-validate hook below.
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Require at least one of message text / shared post.
messageSchema.pre("validate", function (next) {
  if (!this.post && !(this.message && this.message.trim())) {
    this.invalidate("message", "A message must contain text or a shared post");
  }
  next();
});

messageSchema.index({ senderId: 1, recieverId: 1 });

export const Message = mongoose.model("Message", messageSchema);
