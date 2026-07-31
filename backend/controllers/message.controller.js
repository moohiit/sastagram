import mongoose from "mongoose";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { Post } from "../models/post.model.js";
import { getRecieverSocketId } from "../socket.io/socket.io.js";
import { io } from "../socket.io/socket.io.js";

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
    // console.log("RecieverId: ",recieverId);

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
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recieverId] },
    });
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recieverId],
      });
    }
    const newMessage = await Message.create({
      senderId,
      recieverId,
      message,
      ...(postId ? { post: postId } : {}),
    });
    if (newMessage) {
      conversation.messages.push(newMessage._id);
    }
    // new message saved to conversation
    await newMessage.save();
    await conversation.save();
    if (newMessage.post) {
      await newMessage.populate(POST_POPULATE);
    }

    //Socket.io integration for realtime messages
    const recieverSocketId = getRecieverSocketId(recieverId);
    if (recieverSocketId) {
      io.to(recieverSocketId).emit('newMessage',newMessage)
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
    if (before) query._id = { $lt: before };

    // Opening the thread marks messages from the other user as read and
    // notifies them in realtime (read receipts).
    const nowRead = await Message.updateMany(
      { senderId: recieverId, recieverId: senderId, read: false },
      { $set: { read: true } }
    );
    if (nowRead.modifiedCount > 0) {
      const otherSocketId = getRecieverSocketId(recieverId);
      if (otherSocketId) io.to(otherSocketId).emit("messagesRead", { by: senderId });
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
      { $match: { $or: [{ senderId: myId }, { recieverId: myId }] } },
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
          pipeline: [{ $project: { username: 1, profilePicture: 1 } }],
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
