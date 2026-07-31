import { Notification } from "../models/notification.model.js";
import { getRecieverSocketId, io } from "../socket.io/socket.io.js";
import { isPushEnabled, sendPushTo } from "./webPush.js";

// Persist a notification and push it live if the recipient is online.
// Never throws — a failed notification must not fail the triggering action.
export const notify = async ({ recipient, sender, type, post = null, text = "" }) => {
  try {
    if (recipient.toString() === sender.toString()) return;
    const notification = await Notification.create({ recipient, sender, type, post, text });
    await notification.populate({ path: "sender", select: "username profilePicture" });

    const socketId = getRecieverSocketId(recipient.toString());
    if (socketId) {
      io.to(socketId).emit("notification", notification);
    } else if (isPushEnabled()) {
      // Recipient is offline — try web push. Never let a push failure
      // propagate to the caller.
      try {
        await sendPushTo(recipient, {
          title: "SastaGram",
          body: `${notification.sender.username} ${text || "interacted with you"}`,
          url: "/notifications",
        });
      } catch (error) {
        console.error("push notify failed:", error.message);
      }
    }
  } catch (error) {
    console.error("notify failed:", error.message);
  }
};
