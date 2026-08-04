import express from "express";
import { addComment, addNewPost, bookmarkPost, deleteComment, deletePost, dislikePost, editPostCaption, getAllPost, getExplorePosts, getPostById, getPostComments, getPostsByHashtag, getSimilarPosts, getUserPost, likePost, searchPosts, toggleCommentLike, votePoll } from '../controllers/post.controller.js';
import { isAuthenticated, optionalAuth } from "../middlewares/isAuthenticated.js";
import Upload from '../middlewares/multer.js';


const router = express.Router();


router.post('/addpost', isAuthenticated, Upload.single('image'), addNewPost);
router.get('/all', optionalAuth, getAllPost);
router.get('/explore', optionalAuth, getExplorePosts);
router.get('/search', optionalAuth, searchPosts);
router.get('/userpost/all', isAuthenticated, getUserPost);
router.get('/tags/:tag', optionalAuth, getPostsByHashtag);
router.get('/:id/like', isAuthenticated, likePost);
router.get('/:id/dislike', isAuthenticated, dislikePost);
router.post('/:id/comment', isAuthenticated, addComment);
router.post('/:id/vote', isAuthenticated, votePoll);
router.get('/:id/comment/all', optionalAuth, getPostComments);
router.delete('/delete/:id', isAuthenticated, deletePost);
router.put('/:id/caption', isAuthenticated, editPostCaption);
router.delete('/comment/:commentId', isAuthenticated, deleteComment);
router.post('/comment/:commentId/like', isAuthenticated, toggleCommentLike);
router.get('/:id/bookmark', isAuthenticated, bookmarkPost);
router.get('/:id/similar', optionalAuth, getSimilarPosts);
// Keep last — matches any single segment, so it must not shadow routes above
router.get('/:id', optionalAuth, getPostById);

export default router;