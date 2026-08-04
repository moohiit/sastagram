import { createSlice } from "@reduxjs/toolkit";

/**
 * Chat state:
 *  - onlineUsers:    array of userIds currently connected (fed by App.jsx socket)
 *  - conversations:  [{ _id: counterpartUserId, lastMessage, lastMessageAt,
 *                       lastSenderId, unread, user: {_id, username, profilePicture} }]
 *                    kept sorted by recency (newest first)
 *  - messages:       currently-open thread, chronological
 *  - prevCursor:     messageId cursor for loading older messages (null = no more)
 *  - typing:         { [userId]: true } while the counterpart is typing
 *  - seen:           { [userId]: timestampMs } — that user has read our messages
 */
const chatSlice = createSlice({
  name: "chat",
  initialState: {
    onlineUsers: [],
    conversations: [],
    conversationsLoaded: false,
    messages: [],
    prevCursor: null,
    typing: {},
    seen: {},
  },
  reducers: {
    setOnlineUsers: (state, action) => {
      state.onlineUsers = action.payload || [];
    },
    // Delta presence events (server no longer re-broadcasts the full list)
    addOnlineUser: (state, action) => {
      if (!state.onlineUsers.includes(action.payload)) {
        state.onlineUsers.push(action.payload);
      }
    },
    removeOnlineUser: (state, action) => {
      state.onlineUsers = state.onlineUsers.filter((id) => id !== action.payload);
    },
    setConversations: (state, action) => {
      state.conversations = action.payload || [];
      state.conversationsLoaded = true;
    },
    // Kept for shell compatibility (LeftSidebar clears messages on logout).
    setMessages: (state, action) => {
      state.messages = action.payload || [];
    },
    // Replace the open thread (initial fetch for a conversation).
    setThread: (state, action) => {
      state.messages = action.payload.messages || [];
      state.prevCursor = action.payload.prevCursor ?? null;
    },
    clearThread: (state) => {
      state.messages = [];
      state.prevCursor = null;
    },
    addMessage: (state, action) => {
      // Reconnects can re-deliver a message — never render duplicate _ids
      if (state.messages.some((m) => m._id === action.payload._id)) return;
      state.messages.push(action.payload);
    },
    // Older page fetched via ?before=<cursor> — goes in front, chronological.
    prependOlder: (state, action) => {
      state.messages = [...(action.payload.messages || []), ...state.messages];
      state.prevCursor = action.payload.prevCursor ?? null;
    },
    // Update/insert a conversation row and move it to the top.
    // payload: { userId, lastMessage, lastMessageAt, lastSenderId, unreadDelta, user? }
    upsertConversation: (state, action) => {
      const { userId, lastMessage, lastMessageAt, lastSenderId, unreadDelta, user } = action.payload;
      const idx = state.conversations.findIndex((c) => c._id === userId);
      let convo;
      if (idx !== -1) {
        convo = state.conversations[idx];
        state.conversations.splice(idx, 1);
      } else {
        convo = { _id: userId, unread: 0, user: user || { _id: userId } };
      }
      if (user) convo.user = user;
      convo.lastMessage = lastMessage;
      convo.lastMessageAt = lastMessageAt;
      convo.lastSenderId = lastSenderId;
      convo.unread = Math.max(0, (convo.unread || 0) + (unreadDelta || 0));
      state.conversations.unshift(convo);
    },
    clearUnread: (state, action) => {
      const convo = state.conversations.find((c) => c._id === action.payload);
      if (convo) convo.unread = 0;
    },
    setTyping: (state, action) => {
      const { userId, isTyping } = action.payload;
      if (isTyping) {
        state.typing[userId] = true;
      } else {
        delete state.typing[userId];
      }
    },
    // The counterpart fetched our thread — our messages to them are now read.
    setSeen: (state, action) => {
      const { userId, at } = action.payload;
      state.seen[userId] = at;
    },
    // Sending a new message invalidates the previous "Seen" state.
    clearSeen: (state, action) => {
      delete state.seen[action.payload];
    },
  },
});

export const {
  setOnlineUsers,
  addOnlineUser,
  removeOnlineUser,
  setConversations,
  setMessages,
  setThread,
  clearThread,
  addMessage,
  prependOlder,
  upsertConversation,
  clearUnread,
  setTyping,
  setSeen,
  clearSeen,
} = chatSlice.actions;
export default chatSlice.reducer;
