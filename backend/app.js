import express, { urlencoded } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import userRoutes from "./routes/user.routes.js";
import postRoutes from './routes/post.routes.js';
import messageRoutes from './routes/message.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import storyRoutes from './routes/story.routes.js';
import aiRoutes from './routes/ai.routes.js';
import pushRoutes from './routes/push.routes.js';
import publicApiRoutes from './routes/publicApi.routes.js';
import swaggerUi from 'swagger-ui-express';
import openapiSpec from './docs/openapi.js';
import errorHandler from './middlewares/errorHandler.js';
import { app } from './socket.io/socket.io.js'
import path from 'path'

// The express app instance is created in socket.io/socket.io.js (it is shared
// with the http server that socket.io attaches to). This module only wires up
// middleware and routes — it never listens, so tests can import it directly.

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
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

// Rate limits: strict on auth endpoints, generous on the rest of the API.
// Disabled under test — rapid-fire supertest requests would trip them.
if (!isTest) {
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
  // The public read-only API gets its own, tighter budget (per IP)
  const publicApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later" },
  });
  app.use('/api/v1/user/register', authLimiter);
  app.use('/api/v1/user/login', authLimiter);
  app.use('/api/v1', apiLimiter);
  app.use('/api/public/v1', publicApiLimiter);
}

// Health check for uptime monitors / Render
app.get('/healthz', (req, res) => res.json({ ok: true }));

// All Api Call here
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/post', postRoutes);
app.use('/api/v1/message', messageRoutes);
app.use('/api/v1/notification', notificationRoutes);
app.use('/api/v1/story', storyRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/push', pushRoutes);

// Public read-only API (unauthenticated, own rate limiter above) + docs.
// Swagger UI works in production too: helmet runs with
// contentSecurityPolicy:false, so its inline scripts/styles are not blocked,
// and both routes are mounted before the SPA catch-all.
app.use('/api/public/v1', publicApiRoutes);
app.use('/api/public/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

//Serve the static frontend build (production single-service deploy)
if (isProduction) {
  app.use(express.static(path.join(__dirname, "/frontend/dist")))
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  })
}

// Global error handler (multer errors, mongo duplicates, everything else)
app.use(errorHandler);

export default app;
