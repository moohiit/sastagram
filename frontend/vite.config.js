import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the Vite server proxies API + websocket traffic to the local
// backend (npm run dev at the repo root starts both). Override the target with
// VITE_PROXY_TARGET if your backend runs elsewhere.
const target = process.env.VITE_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": target,
      "/socket.io": {
        target,
        ws: true,
      },
    },
  },
});
