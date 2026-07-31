import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { getNotifications, markNotificationsRead } from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", isAuthenticated, getNotifications);
router.patch("/read", isAuthenticated, markNotificationsRead);

export default router;
