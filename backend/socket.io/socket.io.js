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

// Back-compat shim for existing callers that only check truthiness before
// emitting; prefer emitToUser/isUserOnline in new code.
export const getRecieverSocketId = (recieverId) =>
  isUserOnline(recieverId) ? userRoom(recieverId) : undefined;

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

const broadcastOnline = () => {
  io.emit("getOnlineUsers", Object.keys(localSockets));
};

io.on("connection", (socket) => {
  const userId = socket.userId;
  socket.join(userRoom(userId));
  (localSockets[userId] ||= new Set()).add(socket.id);
  broadcastOnline();

  // Typing indicators: relay to the target user only, sender identity from JWT
  socket.on("typing", ({ to }) => {
    if (to) emitToUser(to, "typing", { from: userId });
  });
  socket.on("stopTyping", ({ to }) => {
    if (to) emitToUser(to, "stopTyping", { from: userId });
  });

  socket.on("disconnect", () => {
    localSockets[userId]?.delete(socket.id);
    if (!localSockets[userId]?.size) {
      delete localSockets[userId];
      // Best-effort last-active stamp for "Active Xm ago" in DMs
      User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).catch(() => {});
    }
    broadcastOnline();
  });
});

export { app, server, io };
