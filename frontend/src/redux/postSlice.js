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
  },
});
export const { setPosts, setFeedPage, appendFeedPage, updatePostById } = postSlice.actions;
export default postSlice.reducer;
