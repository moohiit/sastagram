import { io } from "socket.io-client";

// Module-level socket singleton. Keeping the socket OUT of redux avoids
// storing a non-serializable instance in the store (redux-toolkit warns on
// every action otherwise) and survives component re-renders just as well.
let socket = null;
const listeners = new Set(); // notify hooks when the socket instance changes

export const getSocket = () => socket;

export const connectSocket = () => {
  if (socket) return socket;
  socket = io("/", {
    transports: ["websocket"],
    withCredentials: true,
  });
  listeners.forEach((fn) => fn(socket));
  return socket;
};

export const closeSocket = () => {
  if (!socket) return;
  socket.close();
  socket = null;
  listeners.forEach((fn) => fn(null));
};

// Subscribe to socket instance changes (for hooks that need to re-bind)
export const onSocketChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
