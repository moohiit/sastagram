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
  },
});
export const { setPosts, setFeedPage, appendFeedPage } = postSlice.actions;
export default postSlice.reducer;
