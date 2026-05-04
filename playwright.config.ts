import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

/**
 * Playwright 설정.
 *
 * 로컬: `npm run e2e` 실행 시 webServer 가 자동으로 dev 서버를 띄운다.
 * CI: 외부에서 빌드/start 한 서버를 가리키도록 E2E_BASE_URL 환경변수 사용 가능.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
