import express from 'express';
import {isAuthenticated} from '../middlewares/isAuthenticated.js';
import { addGroupMember, createGroup, getConversations, getGroupMessages, getGroups, getMessage, getUnreadCounts, leaveGroup, reactToMessage, sendGroupMessage, sendMessage, unsendMessage } from '../controllers/message.controller.js';

const router = express.Router();


router.post('/send/:id', isAuthenticated, sendMessage);
router.get('/all/:id', isAuthenticated, getMessage);
router.get('/unread', isAuthenticated, getUnreadCounts);
router.get('/conversations', isAuthenticated, getConversations);
// Group chats (registered before the /:messageId catch-alls)
router.post('/group', isAuthenticated, createGroup);
router.get('/group', isAuthenticated, getGroups);
router.post('/group/:groupId/send', isAuthenticated, sendGroupMessage);
router.get('/group/:groupId', isAuthenticated, getGroupMessages);
router.post('/group/:groupId/members', isAuthenticated, addGroupMember);
router.delete('/group/:groupId/members/me', isAuthenticated, leaveGroup);

router.post('/:messageId/react', isAuthenticated, reactToMessage);
router.delete('/:messageId', isAuthenticated, unsendMessage);

export default router;