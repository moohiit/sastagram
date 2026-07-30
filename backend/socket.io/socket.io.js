import { Server } from "socket.io";
import express from "express";
import http from "http";
import jwt from "jsonwebtoken";
import cookie from "cookie";

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

const userSocketMap = {}; // userId => socketId

export const getRecieverSocketId = (recieverId) => {
  return userSocketMap[recieverId];
};

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
  userSocketMap[userId] = socket.id;
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    // Only clear the mapping if this socket is still the active one for the user
    if (userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io };
