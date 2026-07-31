import { Notification } from "../models/notification.model.js";

// GET /api/v1/notification?cursor=<id>&limit=20
export const getNotifications = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const { cursor } = req.query;
    const query = { recipient: req.id };
    if (cursor) query._id = { $lt: cursor };

    const notifications = await Notification.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({ path: "sender", select: "username profilePicture" });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    const unreadCount = await Notification.countDocuments({ recipient: req.id, read: false });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      nextCursor: hasMore ? notifications[notifications.length - 1]._id : null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /api/v1/notification/read — mark all of the user's notifications read
export const markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.id, read: false }, { $set: { read: true } });
    return res.status(200).json({ success: true, message: "Notifications marked read" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
