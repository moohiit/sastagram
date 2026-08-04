import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  persistReducer,
  createTransform,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

import authSlice from "./authSlice";
import postSlice from "./postSlice";
import chatSlice from "./chatSlice";
import rtnSlice from "./rtnSlice";
// v2 migration: browsers that used the pre-rebuild app carry a persist:root
// with the ENTIRE old store (old notification/chat/post shapes). Rehydrating
// those over the new reducers crashed on load (e.g. notifications.length).
// Keep only auth, and backfill fields old auth objects never had.
const migrations = {
  2: (state) => {
    if (!state) return state;
    const auth = state.auth || {};
    return {
      _persist: state._persist,
      auth: {
        ...auth,
        suggestedUsers: Array.isArray(auth.suggestedUsers) ? auth.suggestedUsers : [],
        followings: Array.isArray(auth.followings) ? auth.followings : [],
        userProfile: auth.userProfile ?? null,
        selectedUser: null,
      },
    };
  },
};

// Never persist user.posts — login returns the fully populated post list,
// which nothing reads back and which can blow the ~5MB localStorage quota
// (a failed persist write silently stops ALL auth persistence).
const stripAuthPosts = createTransform(
  (inbound) =>
    inbound?.user?.posts?.length
      ? { ...inbound, user: { ...inbound.user, posts: [] } }
      : inbound,
  null,
  { whitelist: ["auth"] }
);

const persistConfig = {
  key: "root",
  version: 2,
  storage,
  transforms: [stripAuthPosts],
  migrate: (state, version) =>
    Promise.resolve(state && version !== 2 ? migrations[2](state) : state),
  // Only auth survives reloads. Persisting the feed/chat/socket caused stale
  // data on load and stored a non-serializable socket instance.
  whitelist: ["auth"],
};

const appReducer = combineReducers({
  auth: authSlice,
  post: postSlice,
  chat: chatSlice,
  notification:rtnSlice,
});

// Logout dispatches resetApp so EVERY slice returns to its initial state —
// clearing slices one by one left the previous account's followings,
// suggestedUsers and userProfile in persisted state for the next login.
export const RESET_APP = "app/reset";
export const resetApp = () => ({ type: RESET_APP });
const rootReducer = (state, action) =>
  appReducer(action.type === RESET_APP ? undefined : state, action);
const persistedReducer = persistReducer(persistConfig, rootReducer);
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export default store;
