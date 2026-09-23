import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Frank's local dev server (`cd server && npm run dev`).
const FRANK = "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    // The console calls /mcp relatively (ADR-006); in dev, Vite forwards it.
    proxy: {
      "/mcp": FRANK,
      "/healthz": FRANK,
    },
  },
  build: {
    outDir: "dist",
    // Cloudscape is large; one chunk is fine for an internal console.
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    server: { deps: { inline: [/@cloudscape-design/] } },
  },
});
