import {
  addMessage,
  clearUnread,
  setSeen,
  setTyping,
  upsertConversation,
} from "@/redux/chatSlice";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import useSocket from "./useSocket";

/**
 * Real-time messaging subscriptions. Mount once on the chat page (Chat.jsx).
 * Handles:
 *  - "newMessage":    append to the open thread and update the conversation
 *                     list (preview / unread / reorder) without refetching
 *  - "messagesRead":  the counterpart read our messages → "Seen" indicator
 *  - "typing"/"stopTyping": live typing map
 *
 * getState() is used inside a thunk so the socket listener is registered once
 * per socket instead of re-subscribing on every state change.
 */
const useGetRTM = () => {
  const dispatch = useDispatch();
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (newMessage) => {
      dispatch((d, getState) => {
        const { auth } = getState();
        const senderId = newMessage?.senderId;
        if (!senderId) return;
        const isOpenThread = auth.selectedUser?._id === senderId;
        if (isOpenThread) {
          d(addMessage(newMessage));
        }
        d(setTyping({ userId: senderId, isTyping: false }));
        // For senders without an existing conversation row, resolve their
        // identity from followings so the new row has a name and avatar.
        const known = (auth.followings || []).find((f) => f?._id === senderId);
        d(upsertConversation({
          userId: senderId,
          lastMessage: newMessage.message || (newMessage.post ? "Shared a post" : ""),
          lastMessageAt: newMessage.createdAt || new Date().toISOString(),
          lastSenderId: senderId,
          unreadDelta: isOpenThread ? 0 : 1,
          user: known
            ? { _id: known._id, username: known.username, profilePicture: known.profilePicture }
            : undefined,
        }));
        if (isOpenThread) {
          d(clearUnread(senderId));
          // Fetching marks the message read server-side and emits
          // "messagesRead" to the sender, powering their "Seen" receipt.
          axios
            .get(`/api/v1/message/all/${senderId}?limit=1`, { withCredentials: true })
            .catch(() => {});
        }
      });
    };

    const onMessagesRead = ({ by } = {}) => {
      if (by) dispatch(setSeen({ userId: by, at: Date.now() }));
    };

    const onTyping = ({ from } = {}) => {
      if (from) dispatch(setTyping({ userId: from, isTyping: true }));
    };

    const onStopTyping = ({ from } = {}) => {
      if (from) dispatch(setTyping({ userId: from, isTyping: false }));
    };

    socket.on("newMessage", onNewMessage);
    socket.on("messagesRead", onMessagesRead);
    socket.on("typing", onTyping);
    socket.on("stopTyping", onStopTyping);
    return () => {
      socket.off("newMessage", onNewMessage);
      socket.off("messagesRead", onMessagesRead);
      socket.off("typing", onTyping);
      socket.off("stopTyping", onStopTyping);
    };
  }, [socket, dispatch]);
};

export default useGetRTM;
