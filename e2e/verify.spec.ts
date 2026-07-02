import { test, expect } from "@playwright/test";

/**
 * 골든패스 B — /verify 서류 동의·정보 입력 흐름 (간편인증 문서수집).
 *
 * 검증 포인트:
 *   1) sessionId 없이 접근 시 견적 선택 안내 화면 노출
 *   2) 동의 단계: 두 동의 체크박스 모두 체크해야 다음 진행
 *   3) 정보입력 단계: 필드(이름·주민등록번호·휴대폰) 노출 +
 *      필수값 충족 전 "간편인증으로 진행" 버튼 비활성
 *
 * 주의: 본 spec 은 로그인/Codef 호출까지 가지 않는다. 폼 노출·검증 게이트까지만 확인.
 *       (제출 버튼 클릭 시 /api/verification/consent 가 로그인을 요구하므로 클릭하지 않는다.)
 */

test.describe("/verify 폼 검증", () => {
  test("sessionId 없이 진입 시 견적 선택 안내 화면 노출", async ({ page }) => {
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/verify$/);
    await expect(page.getByRole("heading", { name: "심사 서류 간편 확인" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /견적을 선택한 뒤/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "차량 탐색하기" })).toHaveAttribute("href", "/cars");
  });

  test("동의 → 정보입력 폼 노출 + 검증 게이트", async ({ page }) => {
    await page.goto("/verify?sessionId=e2e-test-session-001&customerType=self_employed");

    // Step 1 — 동의
    await expect(page.getByText("공공기관 데이터 조회 안내")).toBeVisible();
    const continueBtn = page.getByRole("button", { name: /동의하고 계속/ });
    await expect(continueBtn).toBeDisabled(); // 미동의 상태에서 비활성

    await page.getByText("[필수] 개인정보 수집·이용에 동의합니다").click();
    await page.getByText("[필수] 공공기관 데이터 조회에 동의합니다").click();

    await expect(continueBtn).toBeEnabled();
    await continueBtn.click();

    // preset customerType=self_employed → 유형 단계 건너뛰고 정보입력 직행
    await expect(page.getByLabel("이름")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("앞 6자리")).toBeVisible();
    await expect(page.getByLabel("휴대폰 번호")).toBeVisible();

    // 미입력 상태에서는 진행 버튼 비활성
    const submitBtn = page.getByRole("button", { name: /간편인증으로 진행/ });
    await expect(submitBtn).toBeDisabled();

    // 필수값(이름·주민번호 앞6/뒤7·휴대폰)을 채우면 활성화
    // 등본 제거로 주소 입력은 더 이상 받지 않는다.
    await page.getByLabel("이름").fill("홍길동");
    await page.getByPlaceholder("앞 6자리").fill("900101");
    await page.getByPlaceholder("뒤 7자리").fill("1234567");
    await page.getByLabel("휴대폰 번호").fill("01012345678");

    await expect(submitBtn).toBeEnabled();
  });
});
