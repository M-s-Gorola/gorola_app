import { defineConfig, mergeConfig } from "vitest/config";

import vite from "./vite.config";

export default mergeConfig(
  vite,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      setupFiles: ["./src/test/setup.ts"],
      testTimeout: 30000
    }
  })
);
