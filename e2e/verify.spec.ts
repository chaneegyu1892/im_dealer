import { test, expect } from "@playwright/test";

/**
 * 골든패스 B — /verify 3단계 서류 동의·정보 입력 흐름.
 *
 * 검증 포인트:
 *   1) sessionId 없이 접근 시 홈으로 redirect
 *   2) sessionId 가 있으면 Step 1 (동의) 노출, 두 동의 체크박스 모두 체크해야 다음 진행
 *   3) Step 2 에서 개인사업자 선택 → Step 3 폼에서 사업자번호 필드 노출
 *   4) Step 3 에서 잘못된 사업자번호로 제출 시 체크섬 검증 에러 메시지 (작업 3에서 도입한 검증)
 *
 * 회귀 위험: 사업자번호 검증을 우회해 잘못된 번호로 Codef API 가 호출되면 비용 손실.
 *
 * 주의: 본 spec 은 실제 Codef 서버 호출까지 가지 않는다. 잘못된 번호 → 에러 노출에서 종료.
 */

test.describe("/verify 폼 검증", () => {
  test("sessionId 없이 진입 시 홈으로 redirect", async ({ page }) => {
    await page.goto("/verify");
    await page.waitForURL("/", { timeout: 10_000 });
    expect(page.url()).toMatch(/\/$/);
  });

  test("3단계 진행 + 잘못된 사업자번호 차단", async ({ page }) => {
    await page.goto("/verify?sessionId=e2e-test-session-001&customerType=self_employed");

    // Step 1 — 동의
    await expect(page.getByText("공공기관 데이터 조회 안내")).toBeVisible();
    const continueBtn = page.getByRole("button", { name: /동의하고 계속/ });
    await expect(continueBtn).toBeDisabled(); // 미동의 상태에서 비활성

    // 두 개의 필수 동의 체크박스 클릭
    await page.getByText("[필수] 개인정보 수집·이용에 동의합니다").click();
    await page.getByText("[필수] 공공기관 데이터 조회에 동의합니다").click();

    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // Step 2 — preset customerType=self_employed 라 자동 진입했어야 정상.
    // 자동 진입하지 않고 Step2 노출되면 '개인사업자' 선택 후 진행.
    const personalBiz = page.getByText("개인사업자").first();
    if (await personalBiz.isVisible().catch(() => false)) {
      await personalBiz.click();
      const nextBtn = page.getByRole("button", { name: /^계속/ }).first();
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
    }

    // Step 3 — 정보입력. 입력 필드 4개 (이름·생년월일·면허·사업자번호) 노출.
    await expect(page.getByLabel("이름")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("이름").fill("홍길동");
    await page.getByLabel("생년월일").fill("19900101");
    await page.getByLabel("운전면허번호").fill("12-34-567890-12");
    await page.getByLabel("사업자등록번호").fill("123-45-67890"); // 체크섬 불일치

    // 제출 버튼 클릭 — 사업자번호 체크섬 검증에서 차단되어야 한다.
    await page.getByRole("button", { name: /제출|확인|조회/ }).first().click();

    // 에러 메시지 노출 확인
    await expect(
      page.getByText(/사업자등록번호가 올바르지 않습니다/)
    ).toBeVisible({ timeout: 5_000 });
  });
});
