import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Same-origin strategy (architecture.md §1): dev server proxies /api to the
// backend so the browser always talks to one origin. Production uses nginx.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
