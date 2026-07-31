import express from "express";
import { addNewStory, deleteStory, getStoriesFeed, markStorySeen } from '../controllers/story.controller.js';
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import Upload from '../middlewares/multer.js';

const router = express.Router();

router.post('/', isAuthenticated, Upload.single('image'), addNewStory);
router.get('/feed', isAuthenticated, getStoriesFeed);
router.patch('/:id/seen', isAuthenticated, markStorySeen);
router.delete('/:id', isAuthenticated, deleteStory);

export default router;
