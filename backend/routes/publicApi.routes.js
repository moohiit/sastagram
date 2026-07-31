import express from "express";
import {
  getPublicPost,
  getPublicUser,
  listPublicPosts,
  searchPublicPosts,
} from "../controllers/publicApi.controller.js";

// Public read-only API (mounted at /api/public/v1 in app.js).
// No auth middleware on purpose — every endpoint is unauthenticated and
// rate limited by its own limiter in app.js.
const router = express.Router();

router.get("/posts", listPublicPosts);
// Register the static /search/posts path before it can be needed — it does
// not collide with /posts/:id, but keeping search grouped here is clearer.
router.get("/search/posts", searchPublicPosts);
router.get("/posts/:id", getPublicPost);
router.get("/users/:username", getPublicUser);

export default router;
