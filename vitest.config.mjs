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
    // .claude/** (Claude Code worktree)와 output/** (스크립트 산출물)도 별개 작업공간/비코드이므로 제외.
    exclude: ["**/node_modules/**", "**/.next/**", "**/e2e/**", "**/.claude/**", "**/output/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
