import express from 'express';
import {
  editProfile,
  followOrUnfollow,
  getFollowers,
  getFollowing,
  getProfile,
  getMe,
  getSuggestedUsers,
  login, logout, register,
  searchProfile,
  
  } from '../controllers/user.controller.js';
import { isAuthenticated } from '../middlewares/isAuthenticated.js';
import upload from '../middlewares/multer.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', isAuthenticated, getMe);
router.get('/:id/profile', isAuthenticated, getProfile);
router.post('/profile/edit', isAuthenticated, upload.single('profilePicture'), editProfile);
router.get('/suggested',isAuthenticated, getSuggestedUsers)
router.get('/followorunfollow/:id', isAuthenticated, followOrUnfollow);
router.get('/search/:id', isAuthenticated, searchProfile);
router.get('/:id/followers', isAuthenticated, getFollowers);
router.get("/:id/following", isAuthenticated, getFollowing);

export default router;