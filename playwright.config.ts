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
  // 차량 이미지 관리 E2E 3종은 격리된 harness와 전용 DB/스토리지 드라이버가 필요하므로
  // 일반 Playwright 실행에서는 제외한다. 전용 vehicle-image-e2e 잡은 spec 파일을 커맨드라인
  // 인자로 직접 지정하여 실행하므로 testIgnore와 무관하게 동작한다.
  testIgnore: ["**/admin-vehicle-images-*.spec.ts"],
  fullyParallel: !isCI,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: process.env.VEHICLE_IMAGE_E2E_TRACE === "1" ? "on" : "retain-on-failure",
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
