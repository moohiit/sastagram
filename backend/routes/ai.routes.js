import express from "express";
import rateLimit from "express-rate-limit";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import upload from "../middlewares/multer.js";
import { getAiStatus, suggestCaptions } from "../controllers/ai.controller.js";

const router = express.Router();

// AI calls are expensive — tight per-user budget. Mounted after
// isAuthenticated, so req.id is the authenticated user (an IP key would be
// shared by everyone behind the proxy/NAT).
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  keyGenerator: (req) => req.id || req.ip,
  message: { success: false, message: "AI limit reached, try again in a few minutes" },
});

router.get("/status", getAiStatus);
router.post("/captions", isAuthenticated, aiLimiter, upload.single("image"), suggestCaptions);

export default router;
