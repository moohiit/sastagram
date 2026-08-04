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
      // Direct messages only — group messages carry `conversation` instead
      required: function () {
        return !this.conversation;
      },
    },
    // Set for group messages (ref to a group Conversation)
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
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
    // Emoji reactions — at most one per user (replaced on re-react)
    reactions: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        emoji: { type: String, required: true },
      },
    ],
    // Unsend = soft delete: content is cleared, the bubble shows "unsent"
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Require at least one of message text / shared post (unsent messages exempt).
messageSchema.pre("validate", function (next) {
  if (!this.deleted && !this.post && !(this.message && this.message.trim())) {
    this.invalidate("message", "A message must contain text or a shared post");
  }
  next();
});

messageSchema.index({ senderId: 1, recieverId: 1 });
messageSchema.index({ conversation: 1, _id: -1 });

export const Message = mongoose.model("Message", messageSchema);
