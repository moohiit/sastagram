import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Canonical pair key ("<lowerId>:<higherId>") — unique so two concurrent
    // first messages can't create duplicate conversations for the same pair.
    key: { type: String, unique: true, sparse: true },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    messages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    }],
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1 });

export const conversationKey = (a, b) =>
  [a.toString(), b.toString()].sort().join(":");

export const Conversation = mongoose.model("Conversation", conversationSchema);
