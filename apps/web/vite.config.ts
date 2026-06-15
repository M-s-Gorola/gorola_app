import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const proxyTarget = process.env.VITE_E2E_PROXY === "true"
  ? `http://127.0.0.1:${process.env.PORT_API || "3002"}`
  : "http://127.0.0.1:3001";

const proxyConfig = {
  "/api": {
    target: proxyTarget,
    changeOrigin: true
  },
  "/socket.io": {
    target: proxyTarget,
    ws: true,
    changeOrigin: true
  }
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  esbuild: {
    supported: {
      destructuring: true
    }
  },
  server: {
    port: 5180,
    allowedHosts: true,
    proxy: proxyConfig
  },
  preview: {
    port: 5180,
    allowedHosts: true,
    proxy: proxyConfig
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
