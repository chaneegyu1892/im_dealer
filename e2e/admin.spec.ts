import { test, expect } from "@playwright/test";

/**
 * 골든패스 C — 어드민 로그인 + 대시보드 + 차량 목록 진입.
 *
 * 검증 포인트:
 *   1) admin_access 쿠키 없으면 /admin 경로가 404 (존재 숨김)
 *   2) 쿠키 + 잘못된 자격증명 → 401
 *   3) 쿠키 + 올바른 자격증명 → /admin 으로 리다이렉트, 사이드바 노출
 *   4) /admin/vehicles 진입 시 차량 목록 로드
 *
 * Read-only 테스트: 데이터 변경하지 않는다 (E2E 가 운영 DB 더럽히지 않도록).
 *
 * 필요 환경변수:
 *   ADMIN_ACCESS_TOKEN — 미들웨어 knock 토큰
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — 시드된 어드민 계정
 *     없으면 ADMIN_INITIAL_EMAIL / ADMIN_INITIAL_PASSWORD 폴백.
 *   하나라도 없으면 spec 자동 skip.
 */

const ACCESS_TOKEN = process.env.ADMIN_ACCESS_TOKEN;
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_INITIAL_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_INITIAL_PASSWORD;

test.describe("어드민 로그인 + 대시보드", () => {
  test.skip(
    !ACCESS_TOKEN || !EMAIL || !PASSWORD,
    "ADMIN_ACCESS_TOKEN / E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD 가 없어 어드민 E2E 건너뜀"
  );

  test("admin_access 쿠키 없이 /admin 진입 시 404", async ({ page }) => {
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });

  test("로그인 → 대시보드 → 차량 목록 → 로그아웃", async ({ page, context }) => {
    // 1) admin_access 쿠키를 미리 세팅하여 미들웨어 knock 통과
    const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const hostname = new URL(baseURL).hostname;
    await context.addCookies([
      {
        name: "admin_access",
        value: ACCESS_TOKEN!,
        domain: hostname,
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
      },
    ]);

    // 2) 로그인 페이지 진입
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: "로그인" })).toBeVisible();

    // 3) 자격증명 입력 + 제출
    await page.getByLabel("이메일").fill(EMAIL!);
    await page.getByLabel("비밀번호").fill(PASSWORD!);

    await Promise.all([
      page.waitForURL(/\/admin\/?$/, { timeout: 15_000 }),
      page.getByRole("button", { name: /^로그인/ }).click(),
    ]);

    // 4) 대시보드 진입 확인 — 사이드바 또는 대시보드 시그니처
    const sidebarVisible = await page
      .getByText(/대시보드|차량 관리|견적 데이터/)
      .first()
      .isVisible()
      .catch(() => false);
    expect(sidebarVisible).toBe(true);

    // 5) 차량 목록 페이지 진입
    await page.goto("/admin/vehicles");
    await expect(
      page.getByText(/차량|브랜드|모델/).first()
    ).toBeVisible({ timeout: 10_000 });

    // 6) 로그아웃 — admin_token 쿠키 삭제 API 호출
    const logoutRes = await page.request.post("/api/admin/auth/logout");
    expect(logoutRes.ok()).toBe(true);

    // 로그아웃 후 /admin/vehicles 재진입하면 로그인 페이지로 redirect 또는 404
    const reentryRes = await page.goto("/admin/vehicles");
    const status = reentryRes?.status() ?? 0;
    expect([200, 302, 404]).toContain(status); // 200 일 경우 리다이렉트 followed
    if (status === 200) {
      // 200 으로 처리됐다면 /admin/login 로 redirect 되어야 한다
      expect(page.url()).toMatch(/\/admin\/login/);
    }
  });

  test("잘못된 자격증명은 에러 메시지 노출", async ({ page, context }) => {
    const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const hostname = new URL(baseURL).hostname;
    await context.addCookies([
      {
        name: "admin_access",
        value: ACCESS_TOKEN!,
        domain: hostname,
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/admin/login");
    await page.getByLabel("이메일").fill("nobody@example.com");
    await page.getByLabel("비밀번호").fill("wrong-password-xyz");
    await page.getByRole("button", { name: /^로그인/ }).click();

    await expect(
      page.getByText(/이메일 또는 비밀번호가 올바르지 않습니다|로그인에 실패/)
    ).toBeVisible({ timeout: 8_000 });
  });
});
