import express, { urlencoded } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { configDotenv } from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import connectDb from './utils/db.js';
import userRoutes from "./routes/user.routes.js";
import postRoutes from './routes/post.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import errorHandler from './middlewares/errorHandler.js';
import { server, app } from './socket.io/socket.io.js'
import path from 'path'

//Configure environment Variables
configDotenv({});

// Fail fast on missing critical config instead of crashing on first request
for (const key of ["MONGO_URI", "JWT_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = process.env.PORT || 8000;
const isProduction = process.env.NODE_ENV === "production";
const __dirname = path.resolve();

//Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // SPA with external images (Cloudinary, avatars)
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(urlencoded({ extended: true }))
app.use(mongoSanitize());

// In production the frontend is served same-origin, so CORS only matters for
// local development (Vite on :5173) or an explicitly configured origin.
const corsOptions = {
  origin: process.env.URL || "http://localhost:5173",
  credentials: true,
}
app.use(cors(corsOptions));

// Rate limits: strict on auth endpoints, generous on the rest of the API
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, please try again later" },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/user/register', authLimiter);
app.use('/api/v1/user/login', authLimiter);
app.use('/api/v1', apiLimiter);

// Health check for uptime monitors / Render
app.get('/healthz', (req, res) => res.json({ ok: true }));

// All Api Call here
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/post', postRoutes);
app.use('/api/v1/message', messageRoutes);
app.use('/api/v1/notification', notificationRoutes);

//Serve the static frontend build (production single-service deploy)
if (isProduction) {
  app.use(express.static(path.join(__dirname, "/frontend/dist")))
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  })
}

// Global error handler (multer errors, mongo duplicates, everything else)
app.use(errorHandler);

//Listen the app on a port
server.listen(PORT, () => {
  connectDb();
  console.log(`Server is running at port ${PORT} (${isProduction ? "production" : "development"})`);
})
