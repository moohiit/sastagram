import mongoose from "mongoose";

// One document per browser push subscription. A user can have several
// (one per device/browser); the endpoint uniquely identifies each.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ user: 1 });

export const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
