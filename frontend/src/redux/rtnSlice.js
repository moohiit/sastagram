import { createSlice } from "@reduxjs/toolkit";

// Real-time + persisted notifications. The list is fetched from
// GET /api/v1/notification on app load; live socket "notification" events
// deliver full persisted notification objects that get prepended.
const rtnSlice = createSlice({
  name: "notification",
  initialState: {
    notifications: [],
    unreadCount: 0,
  },
  reducers: {
    // Replace the whole list (initial fetch)
    setNotifications: (state, action) => {
      state.notifications = action.payload?.notifications || [];
      state.unreadCount = action.payload?.unreadCount || 0;
    },
    // Live socket event: prepend and bump unread
    addNotification: (state, action) => {
      const notification = action.payload;
      if (!notification?._id) return;
      // Guard against duplicates (e.g. reconnects re-emitting)
      if (state.notifications.some((n) => n._id === notification._id)) return;
      state.notifications = [notification, ...state.notifications];
      state.unreadCount += 1;
    },
    markAllRead: (state) => {
      state.unreadCount = 0;
      state.notifications = state.notifications.map((n) =>
        n.read ? n : { ...n, read: true }
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markAllRead,
  clearNotifications,
} = rtnSlice.actions;
export default rtnSlice.reducer;
