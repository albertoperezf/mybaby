import path from "node:path";
import { defineConfig } from "vitest/config";

// Deterministic local-time maths in tests (quiet hours, daily schedules, ICS).
process.env.TZ = "UTC";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
