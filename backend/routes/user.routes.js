import express from 'express';
import {
  editProfile,
  followOrUnfollow,
  getFollowers,
  getFollowing,
  getProfile,
  getMe,
  searchUsers,
  getSuggestedUsers,
  login, logout, register,
  searchProfile,
  
  } from '../controllers/user.controller.js';
import { isAuthenticated, optionalAuth } from '../middlewares/isAuthenticated.js';
import upload from '../middlewares/multer.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', isAuthenticated, getMe);
router.get('/search', optionalAuth, searchUsers);
router.get('/:id/profile', optionalAuth, getProfile);
router.post('/profile/edit', isAuthenticated, upload.single('profilePicture'), editProfile);
router.get('/suggested',isAuthenticated, getSuggestedUsers)
router.get('/followorunfollow/:id', isAuthenticated, followOrUnfollow);
router.get('/search/:id', optionalAuth, searchProfile);
router.get('/:id/followers', optionalAuth, getFollowers);
router.get("/:id/following", optionalAuth, getFollowing);

export default router;