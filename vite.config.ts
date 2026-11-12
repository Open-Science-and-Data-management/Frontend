/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// The backend (uni-backend, NestJS) serves its routes at the root and doesn't
// enable CORS, so in development the app reaches it through this proxy under
// /api: same origin for the browser, nothing to allow on the server.
// BACKEND_URL comes from the shell or a .env file.
export default defineConfig(({ mode }) => {
  const BACKEND_URL =
    loadEnv(mode, process.cwd(), "").BACKEND_URL || "http://localhost:3000";
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: BACKEND_URL,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
          // The refresh-token cookie is set for Path=/auth. Seen through the
          // proxy that path is /api/auth, or the browser would never send it
          // back to /api/auth/refresh.
          cookiePathRewrite: { "/auth": "/api/auth" },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      // The stores persist through localStorage, which only exists in a DOM.
      environment: "jsdom",
      include: ["src/**/*.test.ts"],
      restoreMocks: true,
    },
  };
});
