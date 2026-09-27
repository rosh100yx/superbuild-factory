import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: unit tests are pure module tests and
// should not load the Cloudflare / Agents build plugins.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
