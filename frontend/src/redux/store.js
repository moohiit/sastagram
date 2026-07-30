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
import socketSlice from "./socketSlice";
import chatSlice from "./chatSlice";
import rtnSlice from "./rtnSlice";
const persistConfig = {
  key: "root",
  version: 1,
  storage,
  // Only auth survives reloads. Persisting the feed/chat/socket caused stale
  // data on load and stored a non-serializable socket instance.
  whitelist: ["auth"],
};

const rootReducer = combineReducers({
  auth: authSlice,
  post: postSlice,
  socketio: socketSlice,
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
