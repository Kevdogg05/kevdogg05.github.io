import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "worker/**/*.test.ts", "supabase/**/*.test.ts"],
    // The pipeline integration test renders real video with ffmpeg.
    testTimeout: 60_000,
  },
});
