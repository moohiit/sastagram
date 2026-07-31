import express from 'express';
import {isAuthenticated} from '../middlewares/isAuthenticated.js';
import { getConversations, getMessage, getUnreadCounts, sendMessage } from '../controllers/message.controller.js';

const router = express.Router();


router.post('/send/:id', isAuthenticated, sendMessage);
router.get('/all/:id', isAuthenticated, getMessage);
router.get('/unread', isAuthenticated, getUnreadCounts);
router.get('/conversations', isAuthenticated, getConversations);

export default router;