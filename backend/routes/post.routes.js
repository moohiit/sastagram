import express from "express";
import { addComment, addNewPost, bookmarkPost, deleteComment, deletePost, dislikePost, editPostCaption, getAllPost, getPostComments, getUserPost, likePost } from '../controllers/post.controller.js';
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import Upload from '../middlewares/multer.js';


const router = express.Router();


router.post('/addpost', isAuthenticated, Upload.single('image'), addNewPost);
router.get('/all', isAuthenticated, getAllPost);
router.get('/userpost/all', isAuthenticated, getUserPost);
router.get('/:id/like', isAuthenticated, likePost);
router.get('/:id/dislike', isAuthenticated, dislikePost);
router.post('/:id/comment', isAuthenticated, addComment);
router.get('/:id/comment/all', isAuthenticated, getPostComments);
router.delete('/delete/:id', isAuthenticated, deletePost);
router.put('/:id/caption', isAuthenticated, editPostCaption);
router.delete('/comment/:commentId', isAuthenticated, deleteComment);
router.get('/:id/bookmark', isAuthenticated, bookmarkPost);

export default router;