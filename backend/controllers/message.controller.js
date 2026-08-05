import mongoose from "mongoose";
import { Conversation, conversationKey } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { Post } from "../models/post.model.js";
import { emitToUser, isUserOnline } from "../socket.io/socket.io.js";
import { User } from "../models/user.model.js";
import { isBlockedEitherWay } from "./user.controller.js";
import { isPushEnabled, sendPushTo } from "../utils/webPush.js";

// Shared-post population shape used everywhere a message is returned.
const POST_POPULATE = {
  path: "post",
  select: "image caption author",
  populate: { path: "author", select: "username profilePicture" },
};

// send message controller
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const recieverId = req.params.id;

    if (!mongoose.isValidObjectId(recieverId)) {
      return res.status(400).json({ success: false, message: "Invalid recipient" });
    }
    if (recieverId === senderId) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot message yourself" });
    }
    const recipientExists = await User.exists({ _id: recieverId });
    if (!recipientExists) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }
    if (await isBlockedEitherWay(senderId, recieverId)) {
      return res.status(403).json({ success: false, message: "You cannot message this user" });
    }

    const { message, postId } = req.body;
    if (!postId && !(message && message.trim())) {
      return res.status(400).json({
        success: false,
        message: "Message text or a shared post is required",
      });
    }
    if (postId) {
      const sharedPost = await Post.findById(postId).select("_id");
      if (!sharedPost) {
        return res.status(404).json({
          success: false,
          message: "Post not found",
        });
      }
    }
    // Atomic upsert keyed by the canonical pair key — two simultaneous first
    // messages can no longer create duplicate conversation docs.
    const conversation = await Conversation.findOneAndUpdate(
      { key: conversationKey(senderId, recieverId) },
      {
        $setOnInsert: {
          key: conversationKey(senderId, recieverId),
          participants: [senderId, recieverId],
        },
      },
      { upsert: true, new: true }
    );
    const newMessage = await Message.create({
      senderId,
      recieverId,
      message,
      ...(postId ? { post: postId } : {}),
    });
    await Conversation.updateOne(
      { _id: conversation._id },
      { $push: { messages: newMessage._id } }
    );
    if (newMessage.post) {
      await newMessage.populate(POST_POPULATE);
    }

    // Realtime delivery via the per-user room — routed across instances by the
    // Redis adapter, so this must NOT be gated on the local presence map.
    emitToUser(recieverId, "newMessage", newMessage);
    if (!isUserOnline(recieverId) && isPushEnabled()) {
      // Recipient is offline — web push (fire-and-forget, never fails the send).
      try {
        const sender = await User.findById(senderId).select("username");
        await sendPushTo(recieverId, {
          title: "SastaGram",
          body: `New message from ${sender?.username || "someone"}`,
          url: "/messages",
        });
      } catch (error) {
        console.error("push for message failed:", error.message);
      }
    }
    return res.status(201).json({
      message: "Message sent successfully",
      success:true,
      newMessage,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

//get message controller — paginated (?limit=30&before=<messageId>)
export const getMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const recieverId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { before } = req.query;

    // Query the Message collection directly (indexed) instead of populating
    // a conversation's entire embedded history.
    const query = {
      $or: [
        { senderId, recieverId },
        { senderId: recieverId, recieverId: senderId },
      ],
    };
    if (before) {
      if (!mongoose.isValidObjectId(before)) {
        return res.status(400).json({ success: false, message: "Invalid cursor" });
      }
      query._id = { $lt: before };
    }

    // Opening the thread marks messages from the other user as read and
    // notifies them in realtime (read receipts).
    const nowRead = await Message.updateMany(
      { senderId: recieverId, recieverId: senderId, read: false },
      { $set: { read: true } }
    );
    if (nowRead.modifiedCount > 0) {
      emitToUser(recieverId, "messagesRead", { by: senderId });
    }

    const page = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate(POST_POPULATE);
    const hasMore = page.length > limit;
    if (hasMore) page.pop();
    page.reverse(); // chronological order for the client

    return res.status(200).json({
      messages: page,
      prevCursor: hasMore ? page[0]._id : null,
      message: "Messages fetched successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


// Allowed reaction set — mirrors the frontend picker
const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

// Everyone allowed to see (and get realtime updates for) a message — the DM
// pair, or every member of the group conversation.
const messageParticipants = async (message) => {
  if (message.conversation) {
    const group = await Conversation.findById(message.conversation).select("participants");
    return (group?.participants || []).map((p) => p.toString());
  }
  return [message.senderId.toString(), message.recieverId.toString()];
};

// POST /api/v1/message/:messageId/react { emoji } — toggle/replace the
// caller's reaction. Same emoji again removes it; a different one replaces it.
export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body || {};
    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }
    if (!REACTION_EMOJIS.includes(emoji)) {
      return res.status(400).json({ success: false, message: "Invalid reaction" });
    }
    const message = await Message.findById(messageId);
    if (!message || message.deleted) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    const participants = await messageParticipants(message);
    if (!participants.includes(req.id)) {
      return res.status(403).json({ success: false, message: "Not your conversation" });
    }
    const existing = message.reactions.find((r) => r.user.toString() === req.id);
    if (existing && existing.emoji === emoji) {
      message.reactions = message.reactions.filter((r) => r.user.toString() !== req.id);
    } else {
      message.reactions = [
        ...message.reactions.filter((r) => r.user.toString() !== req.id),
        { user: req.id, emoji },
      ];
    }
    await message.save();

    const payload = { messageId: message._id, reactions: message.reactions };
    for (const userId of participants) emitToUser(userId, "messageReaction", payload);
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /api/v1/message/:messageId — unsend (sender only, soft delete)
export const unsendMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ success: false, message: "Invalid message id" });
    }
    const message = await Message.findById(messageId);
    if (!message || message.deleted) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }
    if (message.senderId.toString() !== req.id) {
      return res.status(403).json({ success: false, message: "You can only unsend your own messages" });
    }
    message.deleted = true;
    message.message = "";
    message.post = undefined;
    message.reactions = [];
    await message.save();

    const payload = { messageId: message._id };
    for (const userId of await messageParticipants(message)) {
      emitToUser(userId, "messageUnsent", payload);
    }
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/message/unread — unread message counts grouped by sender
export const getUnreadCounts = async (req, res) => {
  try {
    const counts = await Message.aggregate([
      { $match: { recieverId: new mongoose.Types.ObjectId(req.id), read: false } },
      { $group: { _id: "$senderId", count: { $sum: 1 } } },
    ]);
    return res.status(200).json({
      success: true,
      unread: Object.fromEntries(counts.map((c) => [c._id.toString(), c.count])),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/message/conversations — DM list: one row per counterpart with
// last message, unread count, and the counterpart's public profile fields.
export const getConversations = async (req, res) => {
  try {
    const myId = new mongoose.Types.ObjectId(req.id);
    const rows = await Message.aggregate([
      // conversation:null keeps group messages out of the DM list
      { $match: { conversation: null, $or: [{ senderId: myId }, { recieverId: myId }] } },
      { $sort: { _id: -1 } },
      {
        $addFields: {
          counterpart: {
            $cond: [{ $eq: ["$senderId", myId] }, "$recieverId", "$senderId"],
          },
        },
      },
      {
        $group: {
          _id: "$counterpart",
          lastMessage: {
            // Post-share messages without text preview as "Shared a post".
            $first: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$post", null] },
                    { $eq: [{ $ifNull: ["$message", ""] }, ""] },
                  ],
                },
                "Shared a post",
                "$message",
              ],
            },
          },
          lastMessageAt: { $first: "$createdAt" },
          lastSenderId: { $first: "$senderId" },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$recieverId", myId] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          pipeline: [{ $project: { username: 1, profilePicture: 1, lastActiveAt: 1 } }],
          as: "user",
        },
      },
      { $unwind: "$user" },
    ]);
    return res.status(200).json({ success: true, conversations: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ---------------------------------------------------------------------------
// Group chats
// ---------------------------------------------------------------------------

const GROUP_NAME_MAX = 60;
const GROUP_MAX_MEMBERS = 50;

const loadGroupForMember = async (groupId, userId) => {
  if (!mongoose.isValidObjectId(groupId)) return { error: [400, "Invalid group id"] };
  const group = await Conversation.findOne({ _id: groupId, isGroup: true });
  if (!group) return { error: [404, "Group not found"] };
  if (!group.participants.some((p) => p.toString() === userId)) {
    return { error: [403, "You are not a member of this group"] };
  }
  return { group };
};

// POST /api/v1/message/group { name, participantIds: [] }
export const createGroup = async (req, res) => {
  try {
    const { name, participantIds } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > GROUP_NAME_MAX) {
      return res.status(400).json({ success: false, message: `Group name is required (max ${GROUP_NAME_MAX} characters)` });
    }
    if (!Array.isArray(participantIds) || participantIds.length < 2) {
      return res.status(400).json({ success: false, message: "Pick at least 2 people" });
    }
    const ids = [...new Set(participantIds.map(String))].filter(
      (id) => mongoose.isValidObjectId(id) && id !== req.id
    );
    if (ids.length < 2) {
      return res.status(400).json({ success: false, message: "Pick at least 2 other people" });
    }
    if (ids.length + 1 > GROUP_MAX_MEMBERS) {
      return res.status(400).json({ success: false, message: `Groups are capped at ${GROUP_MAX_MEMBERS} members` });
    }
    const found = await User.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) {
      return res.status(404).json({ success: false, message: "Some users were not found" });
    }
    const group = await Conversation.create({
      isGroup: true,
      name: name.trim(),
      admin: req.id,
      participants: [req.id, ...ids],
    });
    const populated = await group.populate("participants", "username profilePicture");
    for (const member of populated.participants) {
      emitToUser(member._id.toString(), "groupCreated", { group: populated });
    }
    return res.status(201).json({ success: true, group: populated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/message/group — my groups with last-message preview
export const getGroups = async (req, res) => {
  try {
    const groups = await Conversation.find({ isGroup: true, participants: req.id })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("participants", "username profilePicture")
      .lean();
    const lastMessages = await Message.aggregate([
      { $match: { conversation: { $in: groups.map((g) => g._id) } } },
      { $sort: { _id: -1 } },
      { $group: { _id: "$conversation", message: { $first: "$message" }, post: { $first: "$post" }, senderId: { $first: "$senderId" }, createdAt: { $first: "$createdAt" }, deleted: { $first: "$deleted" } } },
    ]);
    const lastByGroup = new Map(lastMessages.map((m) => [m._id.toString(), m]));
    // Unread per group: messages from others newer than my read stamp
    const unreadCounts = await Promise.all(
      groups.map((g) => {
        const myRead = (g.reads || []).find((r) => r.user.toString() === req.id);
        return Message.countDocuments({
          conversation: g._id,
          senderId: { $ne: req.id },
          ...(myRead ? { createdAt: { $gt: myRead.at } } : {}),
        });
      })
    );
    const payload = groups.map((g, i) => {
      const last = lastByGroup.get(g._id.toString());
      const { messages, reads, ...rest } = g;
      return {
        ...rest,
        lastMessage: last ? (last.deleted ? "Message unsent" : last.message || (last.post ? "Shared a post" : "")) : "",
        lastMessageAt: last?.createdAt || g.updatedAt,
        lastSenderId: last?.senderId || null,
        unread: unreadCounts[i],
      };
    });
    return res.status(200).json({ success: true, groups: payload });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/message/group/:groupId/send { message }
export const sendGroupMessage = async (req, res) => {
  try {
    const { group, error } = await loadGroupForMember(req.params.groupId, req.id);
    if (error) return res.status(error[0]).json({ success: false, message: error[1] });
    const { message, postId } = req.body || {};
    if (!postId && !(message && message.trim())) {
      return res.status(400).json({ success: false, message: "Message text or a shared post is required" });
    }
    if (postId) {
      if (!mongoose.isValidObjectId(postId) || !(await Post.exists({ _id: postId }))) {
        return res.status(404).json({ success: false, message: "Post not found" });
      }
    }
    const newMessage = await Message.create({
      senderId: req.id,
      conversation: group._id,
      message: (message || "").trim(),
      ...(postId ? { post: postId } : {}),
    });
    await Conversation.updateOne(
      { _id: group._id },
      { $push: { messages: newMessage._id } }
    );
    await newMessage.populate("senderId", "username profilePicture");
    if (newMessage.post) await newMessage.populate(POST_POPULATE);
    for (const member of group.participants) {
      emitToUser(member.toString(), "newGroupMessage", {
        conversationId: group._id,
        message: newMessage,
      });
    }
    return res.status(201).json({ success: true, newMessage });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /api/v1/message/group/:groupId?limit=&before= — paginated history
export const getGroupMessages = async (req, res) => {
  try {
    const { group, error } = await loadGroupForMember(req.params.groupId, req.id);
    if (error) return res.status(error[0]).json({ success: false, message: error[1] });
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const { before } = req.query;
    const query = { conversation: group._id };
    if (before) {
      if (!mongoose.isValidObjectId(before)) {
        return res.status(400).json({ success: false, message: "Invalid cursor" });
      }
      query._id = { $lt: before };
    }
    // Opening the thread stamps my read marker (powers the unread badge)
    await Conversation.updateOne(
      { _id: group._id, "reads.user": req.id },
      { $set: { "reads.$.at": new Date() } },
      { timestamps: false }
    ).then(async (r) => {
      if (r.matchedCount === 0) {
        await Conversation.updateOne(
          { _id: group._id },
          { $push: { reads: { user: req.id, at: new Date() } } },
          { timestamps: false }
        );
      }
    });

    const page = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("senderId", "username profilePicture")
      .populate(POST_POPULATE);
    const hasMore = page.length > limit;
    if (hasMore) page.pop();
    page.reverse();
    return res.status(200).json({
      success: true,
      messages: page,
      prevCursor: hasMore ? page[0]._id : null,
      group: await group.populate("participants", "username profilePicture"),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /api/v1/message/group/:groupId/members { userId } — admin only
export const addGroupMember = async (req, res) => {
  try {
    const { group, error } = await loadGroupForMember(req.params.groupId, req.id);
    if (error) return res.status(error[0]).json({ success: false, message: error[1] });
    if (group.admin.toString() !== req.id) {
      return res.status(403).json({ success: false, message: "Only the admin can add members" });
    }
    const { userId } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    if (!(await User.exists({ _id: userId }))) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (group.participants.length >= GROUP_MAX_MEMBERS) {
      return res.status(400).json({ success: false, message: `Groups are capped at ${GROUP_MAX_MEMBERS} members` });
    }
    await Conversation.updateOne(
      { _id: group._id },
      { $addToSet: { participants: userId } }
    );
    emitToUser(userId, "groupCreated", {
      group: await Conversation.findById(group._id).populate("participants", "username profilePicture"),
    });
    return res.status(200).json({ success: true, message: "Member added" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /api/v1/message/group/:groupId/members/me — leave; the admin role
// passes to the longest-standing member, and an empty group is deleted.
export const leaveGroup = async (req, res) => {
  try {
    const { group, error } = await loadGroupForMember(req.params.groupId, req.id);
    if (error) return res.status(error[0]).json({ success: false, message: error[1] });
    const remaining = group.participants.filter((p) => p.toString() !== req.id);
    if (remaining.length === 0) {
      await Message.deleteMany({ conversation: group._id });
      await Conversation.deleteOne({ _id: group._id });
    } else {
      const update = { $pull: { participants: req.id } };
      if (group.admin.toString() === req.id) {
        update.$set = { admin: remaining[0] };
      }
      await Conversation.updateOne({ _id: group._id }, update);
      for (const member of remaining) {
        emitToUser(member.toString(), "groupUpdated", { conversationId: group._id });
      }
    }
    return res.status(200).json({ success: true, message: "Left group" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
