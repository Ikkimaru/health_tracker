import { defineConfig } from "vitest/config";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/health_tracker/" : "/",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
