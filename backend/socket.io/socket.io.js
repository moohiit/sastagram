import { Server } from "socket.io";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import { User } from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    // Read lazily via callback — dotenv runs after this module is imported
    origin: (origin, cb) => cb(null, process.env.URL || "http://localhost:5173"),
    methods: ["POST", "GET"],
    credentials: true,
  },
});

// Optional horizontal scaling: with REDIS_URL configured, the Redis adapter
// broadcasts events across every server instance. Called from server.js after
// boot; a failed Redis connection falls back to the in-memory adapter.
export const initRedisAdapter = async () => {
  if (!process.env.REDIS_URL) return false;
  try {
    const { createClient } = await import("redis");
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("socket.io: Redis adapter enabled");
    return true;
  } catch (error) {
    console.error("socket.io: Redis adapter failed, using in-memory:", error.message);
    return false;
  }
};

// Delivery uses per-user rooms (user:<id>) — correct across instances when the
// Redis adapter is active. The local map only powers the online-users list and
// presence checks (approximate under multi-instance; documented trade-off).
const localSockets = {}; // userId => Set<socketId> (this instance only)

export const userRoom = (userId) => `user:${userId}`;
export const emitToUser = (userId, event, payload) => {
  io.to(userRoom(userId)).emit(event, payload);
};
export const isUserOnline = (userId) => Boolean(localSockets[userId]?.size);

// Authenticate every socket connection with the same JWT cookie the REST API
// uses. The client-supplied query userId is never trusted.
io.use((socket, next) => {
  try {
    const rawCookies = socket.handshake.headers.cookie;
    if (!rawCookies) return next(new Error("Authentication required"));
    const { token } = cookie.parse(rawCookies);
    if (!token) return next(new Error("Authentication required"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    return next();
  } catch {
    return next(new Error("Authentication failed"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  socket.join(userRoom(userId));
  const firstSocket = !localSockets[userId]?.size;
  (localSockets[userId] ||= new Set()).add(socket.id);

  // Presence is delta-based: the connecting socket gets one full snapshot,
  // everyone else only hears about transitions. The old full-list io.emit on
  // every connect/disconnect was O(users²) payload under churn.
  socket.emit("getOnlineUsers", Object.keys(localSockets));
  if (firstSocket) socket.broadcast.emit("userOnline", userId);

  // Typing indicators: relay to the target user only, sender identity from
  // JWT. Only relayed once a conversation between the pair exists, so
  // arbitrary users can't paint phantom typing bubbles into strangers' chats.
  const typingApproved = new Set();
  const relayTyping = async (event, to) => {
    if (!to || typeof to !== "string") return;
    if (!typingApproved.has(to)) {
      const { Conversation } = await import("../models/conversation.model.js");
      const exists = await Conversation.exists({
        participants: { $all: [userId, to] },
      }).catch(() => null);
      if (!exists) return;
      typingApproved.add(to);
    }
    emitToUser(to, event, { from: userId });
  };
  socket.on("typing", ({ to } = {}) => relayTyping("typing", to));
  socket.on("stopTyping", ({ to } = {}) => relayTyping("stopTyping", to));

  socket.on("disconnect", () => {
    localSockets[userId]?.delete(socket.id);
    if (!localSockets[userId]?.size) {
      delete localSockets[userId];
      socket.broadcast.emit("userOffline", userId);
      // Best-effort last-active stamp for "Active Xm ago" in DMs
      User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).catch(() => {});
    }
  });
});

export { app, server, io };
