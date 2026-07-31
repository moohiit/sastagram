import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  image: { type: String, required: true },
  // Users who have viewed this story (capped-growth concern acceptable here)
  seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
});

// MongoDB TTL: stories are automatically deleted 24h after creation
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
storySchema.index({ author: 1 });

export const Story = mongoose.model("Story", storySchema);
