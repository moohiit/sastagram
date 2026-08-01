import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  persistReducer,
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

const persistConfig = {
  key: "root",
  version: 2,
  storage,
  migrate: (state, version) =>
    Promise.resolve(state && version !== 2 ? migrations[2](state) : state),
  // Only auth survives reloads. Persisting the feed/chat/socket caused stale
  // data on load and stored a non-serializable socket instance.
  whitelist: ["auth"],
};

const rootReducer = combineReducers({
  auth: authSlice,
  post: postSlice,
  chat: chatSlice,
  notification:rtnSlice,
});
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
