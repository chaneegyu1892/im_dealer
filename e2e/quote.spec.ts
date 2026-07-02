import { test, expect } from "@playwright/test";

/**
 * 골든패스 A — 공개 견적 산출 흐름.
 *
 * 검증 포인트:
 *   1) 홈에서 '주목할 차량' 섹션이 1개 이상 노출
 *   2) 첫 차량 카드 클릭 시 /cars/<slug> 로 이동
 *   3) 차량 상세 페이지 메타데이터 (제목·OG) 가 차량명 기반으로 동적 생성
 *   4) 시나리오 카드(보수/표준/공격형) 또는 견적 안내가 노출
 *
 * 회귀 위험: 견적 계산기 단위 테스트는 통과해도 라우팅/SSR/캐싱이 깨지면
 * 사용자가 차량 상세에 들어가지 못한다 → 매출 0. 본 spec 이 1차 그물망.
 */

test.describe("공개 견적 골든패스", () => {
  test("홈 → 인기 차량 → 차량 상세 → 견적 시나리오 노출", async ({ page }) => {
    await page.goto("/");

    // Hero 섹션이 로드되었는지: 핵심 헤드라인 카피로 확인
    await expect(page.getByText("차를 고르기 전에", { exact: false }).first()).toBeVisible();

    // 인기 차량 카드 — /cars/<slug> 로 향하는 링크 (목록 /cars 자체는 제외)
    const carLinks = page.locator('a[href^="/cars/"]:not([href="/cars"])');
    const firstCar = carLinks.first();
    await expect(firstCar).toBeVisible({ timeout: 15_000 });

    const href = await firstCar.getAttribute("href");
    expect(href).toMatch(/^\/cars\/[a-z0-9-]+$/);

    // 차량 상세로 이동 — 직접 goto 가 클릭보다 안정적 (motion 애니메이션·viewport observer 영향 최소화)
    await page.goto(href!);

    // generateMetadata 동작 확인 — 차량 상세 title 은 '... | 아임딜러' 패턴이고 기본 카피와 다름
    await expect(page).toHaveTitle(/장기렌트·리스 견적 \| 아임딜러$/);

    // JSON-LD 구조화 데이터(Product + BreadcrumbList) 2개 삽입 확인
    const jsonLdCount = await page.locator('script[type="application/ld+json"]').count();
    expect(jsonLdCount).toBeGreaterThanOrEqual(2);

    // 차량 상세 본문 — 시나리오 또는 가격 표시
    const hasMonthly = await page.getByText(/월 납입금|만원/).first().isVisible().catch(() => false);
    const hasScenarioLabel = await page.getByText(/보수|표준|공격|추천/).first().isVisible().catch(() => false);
    expect(hasMonthly || hasScenarioLabel).toBe(true);
  });

  test("/cars/<invalid-slug> 는 not-found 처리", async ({ page }) => {
    await page.goto("/cars/this-slug-does-not-exist-12345");
    await expect(
      page.getByRole("heading", { name: "차량을 찾을 수 없습니다" })
    ).toBeVisible();
  });
});
