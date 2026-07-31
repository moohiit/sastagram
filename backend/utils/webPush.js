import webpush from "web-push";
import { PushSubscription } from "../models/pushSubscription.model.js";

// Web push is optional: when the VAPID env vars are not configured,
// isPushEnabled() is false, the frontend hides its notification toggle and
// no push is ever attempted. Generate keys with:
//   npx web-push generate-vapid-keys

let configured = false;

export const isPushEnabled = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const ensureConfigured = () => {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:mohit.patel.edu@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
};

// Send a push payload to every subscription the user has. Subscriptions the
// push service reports as gone (404/410) are pruned. Never throws — a failed
// push must not fail the triggering action.
export const sendPushTo = async (userId, payload) => {
  try {
    if (!isPushEnabled()) return;
    ensureConfigured();

    const subscriptions = await PushSubscription.find({ user: userId });
    if (subscriptions.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            body
          );
        } catch (error) {
          if (error.statusCode === 404 || error.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          } else {
            console.error("web push failed:", error.message);
          }
        }
      })
    );
  } catch (error) {
    console.error("sendPushTo failed:", error.message);
  }
};
