import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      "/api": {
        // Only shift the port if explicitly in E2E mode to avoid local dev "leaks"
        target: process.env.VITE_E2E_PROXY === "true"
          ? `http://127.0.0.1:${process.env.PORT_API || "3002"}`
          : "http://127.0.0.1:3001",
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
