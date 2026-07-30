// Load environment variables before anything else — app.js reads process.env
// (CORS origin, NODE_ENV) at import time, and ESM imports are hoisted.
import 'dotenv/config';
import mongoose from 'mongoose';
import connectDb from './utils/db.js';
import { server } from './socket.io/socket.io.js';
import './app.js'; // wires all middleware/routes onto the shared express app

// Fail fast on missing critical config instead of crashing on first request
for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === "production";

//Listen the app on a port
server.listen(PORT, () => {
  connectDb();
  console.log(`Server is running at port ${PORT} (${isProduction ? "production" : "development"})`);
})

// Graceful shutdown: stop accepting connections, close the DB, then exit.
// A 10s force-exit fallback guards against hung connections.
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error("Forced shutdown after 10s timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    console.log("HTTP server closed");
    try {
      // Force-close, bounded: a connection stuck mid-retry (DB unreachable)
      // would otherwise block close() until the driver's selection timeout.
      await Promise.race([
        mongoose.connection.close(true),
        new Promise((resolve) => setTimeout(resolve, 5_000).unref()),
      ]);
      console.log("MongoDB connection closed");
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
