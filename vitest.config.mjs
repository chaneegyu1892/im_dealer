import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./setupTests.ts",
    // Playwright spec 은 별도 러너로 실행. Vitest 가 e2e/**.spec.ts 를 잡지 않도록 제외.
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
