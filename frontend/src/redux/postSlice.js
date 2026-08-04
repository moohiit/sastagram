import { createSlice } from "@reduxjs/toolkit";

const postSlice = createSlice({
  name: "post",
  initialState: {
    posts: [],
    nextCursor: null,
    hasFetched: false,
  },
  reducers: {
    setPosts: (state, action) => {
      state.posts = action.payload;
    },
    setFeedPage: (state, action) => {
      state.posts = action.payload.posts;
      state.nextCursor = action.payload.nextCursor ?? null;
      state.hasFetched = true;
    },
    appendFeedPage: (state, action) => {
      const seen = new Set(state.posts.map((p) => p._id));
      state.posts.push(...action.payload.posts.filter((p) => !seen.has(p._id)));
      state.nextCursor = action.payload.nextCursor ?? null;
    },
    // Shallow-merge `changes` into the post with `_id` (e.g. caption edits).
    updatePostById: (state, action) => {
      const { _id, changes } = action.payload;
      const idx = state.posts.findIndex((p) => p._id === _id);
      if (idx !== -1) state.posts[idx] = { ...state.posts[idx], ...changes };
    },
    // Prepend a newly created post (never replaces the array — a stale
    // snapshot in the caller can't wipe pages loaded since).
    addPost: (state, action) => {
      if (action.payload?._id) state.posts.unshift(action.payload);
    },
    removePostById: (state, action) => {
      state.posts = state.posts.filter((p) => p._id !== action.payload);
    },
    // Toggle a post's like state (optimistic like/unlike). Maintains the
    // Stage-2 fields (likedByMe/likesCount) and the legacy likes array when
    // present.
    setPostLiked: (state, action) => {
      const { _id, userId, liked } = action.payload;
      const post = state.posts.find((p) => p._id === _id);
      if (!post) return;
      const prevCount = post.likesCount ?? post.likes?.length ?? 0;
      post.likesCount = Math.max(0, prevCount + (liked ? 1 : -1));
      post.likedByMe = liked;
      if (Array.isArray(post.likes)) {
        const likes = post.likes.filter((id) => id !== userId);
        if (liked) likes.push(userId);
        post.likes = likes;
      }
    },
  },
});
export const {
  setPosts,
  setFeedPage,
  appendFeedPage,
  updatePostById,
  addPost,
  removePostById,
  setPostLiked,
} = postSlice.actions;
export default postSlice.reducer;
