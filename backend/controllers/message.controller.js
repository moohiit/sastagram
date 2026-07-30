import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { getRecieverSocketId } from "../socket.io/socket.io.js";
import { io } from "../socket.io/socket.io.js";

// send message controller
export const sendMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const recieverId = req.params.id;
    // console.log("RecieverId: ",recieverId);
    
    const { message } = req.body;
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
    });
    if (newMessage) {
      conversation.messages.push(newMessage._id);
    }
    // new message saved to conversation
    await newMessage.save();
    await conversation.save();

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

    const page = await Message.find(query).sort({ _id: -1 }).limit(limit + 1);
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
