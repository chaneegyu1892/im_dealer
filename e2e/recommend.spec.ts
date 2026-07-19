import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}

async function expectQuestionAtReadingPosition(page: Page, name: string) {
  const heading = page.getByRole("heading", { name, exact: true });
  await expect(heading).toBeInViewport({ ratio: 1 });
  const headingTop = () =>
    heading.evaluate((element) => Math.round(element.getBoundingClientRect().top));
  await expect.poll(headingTop).toBeGreaterThan(80);
  await expect.poll(headingTop).toBeLessThan(240);
}

async function completeHevFamilyFlow(page: Page) {
  await page.goto("/recommend");
  await choose(page, "개인 직장인·프리랜서·비사업자 모두 포함");
  await choose(page, "월 100만원 이하 선택 폭과 월 부담을 함께 봐요");
  await choose(page, "다음");
  await choose(page, "🚙 크고 안정감 있는 차 든든한 주행감");
  await choose(page, "👨‍👩‍👧 아이와 함께 타요 가족·안전 우선");
  await choose(page, "🧒 미취학 (4~7세) 카시트 환경");
  await choose(page, "다음");
  await choose(page, "추천 적당히 타요 (연 2만km) 80% 고객이 선택하는 평균 주행 패턴");
  await choose(page, "🌿 하이브리드 연비와 주행거리 모두 잡아요");
  await choose(page, "🏙️ 일반 지역 수도권·도심 등");
  await choose(page, "추천 결과 확인하기");
}

test("answer selection scrolls every next recommendation question into reading position", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/recommend");

  await choose(page, "개인 직장인·프리랜서·비사업자 모두 포함");
  await expectQuestionAtReadingPosition(page, "월 납입금 예산은 어느 정도인가요?");

  await choose(page, "월 100만원 이하 선택 폭과 월 부담을 함께 봐요");
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeInViewport();
  await choose(page, "다음");

  await choose(page, "🚙 크고 안정감 있는 차 든든한 주행감");
  await expectQuestionAtReadingPosition(page, "아이나 짐 관련 조건이 있나요?");

  await choose(page, "👨‍👩‍👧 아이와 함께 타요 가족·안전 우선");
  await expectQuestionAtReadingPosition(page, "자녀 연령대는 어떻게 되나요?");

  await choose(page, "🧒 미취학 (4~7세) 카시트 환경");
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeInViewport();
  await choose(page, "다음");

  await choose(page, "추천 적당히 타요 (연 2만km) 80% 고객이 선택하는 평균 주행 패턴");
  await expectQuestionAtReadingPosition(page, "연료 방식에 선호가 있으신가요?");

  await choose(page, "⚡ 전기차 충전 인프라 있음, 유지비 절감");
  await expectQuestionAtReadingPosition(page, "충전 환경이 있나요?");

  await choose(page, "🏠 자택 충전 가능 집에서 충전돼요");
  await expectQuestionAtReadingPosition(page, "주로 어느 지역에서 운행하세요?");

  await choose(page, "🏙️ 일반 지역 수도권·도심 등");
  await expect(page.getByRole("button", { name: "추천 결과 확인하기" })).toBeInViewport();
});

test("no-detail and non-EV answers scroll directly to their next action", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/recommend");

  await choose(page, "개인 직장인·프리랜서·비사업자 모두 포함");
  await choose(page, "월 100만원 이하 선택 폭과 월 부담을 함께 봐요");
  await choose(page, "다음");

  await choose(page, "해당 없음 딱 맞는 차종 기준이 없어요");
  await expectQuestionAtReadingPosition(page, "아이나 짐 관련 조건이 있나요?");

  await choose(page, "해당 없음 추가 조건이 따로 없어요");
  await expect(page.getByRole("button", { name: "다음", exact: true })).toBeInViewport();
  await choose(page, "다음");

  await choose(page, "추천 적당히 타요 (연 2만km) 80% 고객이 선택하는 평균 주행 패턴");
  await expectQuestionAtReadingPosition(page, "연료 방식에 선호가 있으신가요?");

  await choose(page, "🌿 하이브리드 연비와 주행거리 모두 잡아요");
  await expectQuestionAtReadingPosition(page, "주로 어느 지역에서 운행하세요?");

  await choose(page, "🏙️ 일반 지역 수도권·도심 등");
  await expect(page.getByRole("button", { name: "추천 결과 확인하기" })).toBeInViewport();
});

for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 900 }]) {
  test(`zero-result UI keeps the unchanged public flow at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/recommend**", async (route) => {
      if (route.request().method() === "POST") {
        const payload = route.request().postDataJSON();
        expect(payload).toMatchObject({
          industry: "개인",
          budgetMax: 1_000_000,
          primaryPreference: "안정감",
          situationPreference: "가족",
          childDetail: "미취학",
          annualMileage: 20_000,
          fuelPreference: "하이브리드",
          residenceRegion: "일반",
        });
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sessionId: "e2e-zero", vehicles: [] }) });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sessionId: "e2e-zero",
            input: { industry: "개인", purpose: "안정감, 가족", annualMileage: 20_000, returnType: "미정" },
            vehicles: [],
          }),
        });
      }
    });
    await completeHevFamilyFlow(page);
    await expect(page.getByRole("heading", { name: "추천 결과가 없어요" })).toBeVisible();
    await expect(page.getByRole("button", { name: "조건 다시 설정하기" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`recommend-zero-${viewport.width}.png`), fullPage: true });
  });
}

test("invalid recommendation POST fails at the strict field boundary", async ({ request }) => {
  const response = await request.post("/api/recommend", {
    data: {
      industry: "개인",
      industryDetail: "1대",
      preferences: [],
      annualMileage: 15_000,
      fuelPreference: "전기차",
      residenceRegion: "일반",
      returnType: "미정",
    },
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body.details.fieldErrors).toMatchObject({ annualMileage: expect.any(Array) });
});
