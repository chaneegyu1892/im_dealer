import { expect, test } from "@playwright/test";

/**
 * 쿠폰함 로그인 게이트.
 *
 * 카카오 회원 세션을 만드는 E2E 픽스처가 아직 없어 로그인 이후 화면은 검증하지 않는다.
 * 쿠폰 목록 구성과 카드 렌더링은 다음 단위 테스트가 덮는다.
 *   - src/lib/member-queries/coupons.test.ts
 *   - src/components/mypage/CouponTicket.test.tsx
 */
test.describe("쿠폰함", () => {
  test("비로그인 사용자는 로그인으로 유도된다", async ({ page }) => {
    await page.goto("/mypage/coupons");

    await expect(page).toHaveURL(/\/login/);
  });
});
