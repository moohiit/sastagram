import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { PushSubscription } from "../models/pushSubscription.model.js";
import { isPushEnabled } from "../utils/webPush.js";

const router = express.Router();

// Public: the frontend asks whether push is configured before showing any UI.
router.get("/public-key", (req, res) => {
  if (!isPushEnabled()) {
    return res.status(200).json({ success: true, enabled: false });
  }
  return res.status(200).json({
    success: true,
    enabled: true,
    key: process.env.VAPID_PUBLIC_KEY,
  });
});

// Body is the browser's PushSubscription JSON: { endpoint, keys: { p256dh, auth } }
router.post("/subscribe", isAuthenticated, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ success: false, message: "Invalid subscription" });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(201).json({ success: true, message: "Subscribed to push notifications" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.delete("/unsubscribe", isAuthenticated, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ success: false, message: "Endpoint is required" });
    }
    await PushSubscription.deleteOne({ endpoint, user: req.id });
    return res.status(200).json({ success: true, message: "Unsubscribed from push notifications" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
