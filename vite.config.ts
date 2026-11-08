import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// BASE_PATH serves the app under a sub-path (e.g. "/wrapped/" behind a shared nginx).
// Set the same value for the build and for the server.
const raw = (process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
const base = raw ? `/${raw}/` : "/";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Server mode (no JELLYFIN_API_KEY): forward /api to the backend during development.
    proxy: {
      [`${base}api`]: process.env.WRAPPED_SERVER_URL ?? "http://localhost:3000",
    },
  },
});
