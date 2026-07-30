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

//get message controller
export const getMessage = async (req, res) => {
  try {
    const senderId = req.id;
    const recieverId = req.params.id;
    const conversation = await Conversation.findOne({
      participants: {
        $all: [senderId, recieverId],
      },
    }).populate("messages");
    if (!conversation) {
      return res.status(200).json({
        messages: [],
        message:"No messages till now",
        success: true,
      });
    }
    return res.status(200).json({
      messages: conversation?.messages,
      message:"All messages fetched successfully",
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
