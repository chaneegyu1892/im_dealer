import { expect, test, type Page, type Request, type Route } from "@playwright/test";

/**
 * T41 — client request count on quote save double-click.
 * Server P2002 idempotency is A1/T2. This spec only counts POSTs the
 * browser issues to /api/quote/save. Codef /verify reload is out of scope.
 */

const SAVE_URL_FRAGMENT = "/api/quote/save";
const SAVE_WAIT_MS = 10_000;
const SLUG_WAIT_MS = 15_000;

const CONSULTATION_TRIM_ID = "e2e-quote-save-trim";

/** Step2ConditionV2 CTA after a trim is selected (or trim list is empty). */
const CALCULATE_CTA_NAME =
  /월 납입금 확인하기|선택 조건 확인하기|상담 필요 견적 확인하기/;

function isQuoteSavePost(request: Request): boolean {
  return request.method() === "POST" && request.url().includes(SAVE_URL_FRAGMENT);
}

function sessionIdFromSaveBody(raw: string | null): string {
  if (!raw) return "e2e-session";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return "e2e-session";
    throw error;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "sessionId" in parsed &&
    typeof parsed.sessionId === "string" &&
    parsed.sessionId.length > 0
  ) {
    return parsed.sessionId;
  }
  return "e2e-session";
}

function consultationQuote(vehicleSlug: string) {
  return {
    vehicleSlug,
    trimId: CONSULTATION_TRIM_ID,
    trimName: "E2E 트림",
    trimPrice: 40_000_000,
    optionsTotalPrice: 0,
    colorDelta: 0,
    totalVehiclePrice: 40_000_000,
    contractMonths: 60,
    annualMileage: 20_000,
    contractType: "반납형",
    customerType: "individual",
    scenarios: {
      conservative: {
        monthlyPayment: 0,
        depositAmount: 0,
        prepayAmount: 0,
        contractMonths: 60,
        annualMileage: 20_000,
        contractType: "반납형",
        bestFinanceCompany: "",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      },
      standard: {
        monthlyPayment: 0,
        depositAmount: 0,
        prepayAmount: 0,
        contractMonths: 60,
        annualMileage: 20_000,
        contractType: "반납형",
        bestFinanceCompany: "",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      },
      aggressive: {
        monthlyPayment: 0,
        depositAmount: 0,
        prepayAmount: 0,
        contractMonths: 60,
        annualMileage: 20_000,
        contractType: "반납형",
        bestFinanceCompany: "",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
      },
    },
    requiresConsultation: true,
  };
}

async function fulfillJson(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function firstPublicVehicleSlug(page: Page): Promise<string | null> {
  for (const route of ["/", "/cars"] as const) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const firstCar = page.locator('a[href^="/cars/"]:not([href="/cars"])').first();
    const visible = await firstCar.isVisible({ timeout: SLUG_WAIT_MS }).catch(() => false);
    if (!visible) continue;
    const href = await firstCar.getAttribute("href");
    const match = href ? /^\/cars\/([a-z0-9-]+)/.exec(href) : null;
    if (match?.[1]) return match[1];
  }
  return null;
}

async function stubQuotePrerequisites(page: Page, vehicleSlug: string): Promise<void> {
  await page.route("**/api/vehicles/*/trims", (route) =>
    fulfillJson(route, {
      success: true,
      data: [
        {
          id: CONSULTATION_TRIM_ID,
          name: "E2E 트림",
          price: 40_000_000,
          discountPrice: null,
          evSubsidy: null,
          engineType: "GASOLINE",
          fuelEfficiency: 10,
          isDefault: true,
          specs: null,
          options: [],
          rules: [],
          lineupId: null,
          lineup: null,
          availableProducts: ["장기렌트"],
        },
      ],
    }),
  );
  await page.route("**/api/vehicles/*/colors", (route) =>
    fulfillJson(route, { success: true, data: [] }),
  );
  await page.route("**/api/vehicles/*/quote", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await fulfillJson(route, { success: true, data: consultationQuote(vehicleSlug) });
  });
  await page.route("**/api/logs/exploration", (route) => fulfillJson(route, { ok: true }));
}

async function stubQuoteSaveHeld(page: Page, release: Promise<void>): Promise<void> {
  await page.route(`**${SAVE_URL_FRAGMENT}`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await release;
    const sessionId = sessionIdFromSaveBody(route.request().postData());
    await fulfillJson(route, {
      success: true,
      data: {
        id: "e2e-saved-quote",
        sessionId,
        requiresConsultation: true,
        monthlyPayment: 0,
        totalCost: 0,
        pricingStatus: "CONSULTATION_REQUIRED",
        depositRate: 0,
        prepayRate: 0,
        depositAmount: 0,
        prepayAmount: 0,
        bestFinanceCompany: "",
      },
    });
  });
}

async function pickFirstSheetOption(page: Page, sheetTitle: string): Promise<void> {
  const sheet = page.getByRole("dialog", { name: sheetTitle });
  await expect(sheet).toBeVisible({ timeout: SLUG_WAIT_MS });
  const firstOption = sheet.getByRole("button").filter({ hasNotText: /^닫기$/ }).first();
  await expect(firstOption).toBeVisible({ timeout: SLUG_WAIT_MS });
  await firstOption.click();
  await expect(sheet).toBeHidden({ timeout: SLUG_WAIT_MS });
}

async function ensureCalculateCtaReady(page: Page): Promise<void> {
  const calculateButton = page.getByRole("button", { name: CALCULATE_CTA_NAME });
  const trimTrigger = page.locator("#trim-select");
  const lineupTrigger = page.locator("#lineup-select");
  const skipReady = page.getByText("트림 정보 등록 준비중");
  const trimError = page.getByText("트림 정보를 불러오지 못했어요");

  await expect(page.getByRole("heading", { name: "트림 선택" })).toBeVisible({
    timeout: SLUG_WAIT_MS,
  });

  // Initial trimsLoading is false; wait until fetch settled into a usable UI.
  await expect
    .poll(
      async () => {
        if (await calculateButton.isEnabled().catch(() => false)) return "ready";
        if (await trimTrigger.isVisible().catch(() => false)) return "pick";
        if (await skipReady.isVisible().catch(() => false)) return "ready";
        if (await trimError.isVisible().catch(() => false)) return "error";
        return "wait";
      },
      { timeout: SLUG_WAIT_MS },
    )
    .not.toBe("wait");

  if (await calculateButton.isEnabled().catch(() => false)) return;

  if (await trimError.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "다시 불러오기" }).click();
    await expect(trimError).toBeHidden({ timeout: SLUG_WAIT_MS });
    await expect(trimTrigger.or(skipReady).or(calculateButton)).toBeVisible({
      timeout: SLUG_WAIT_MS,
    });
    if (await calculateButton.isEnabled().catch(() => false)) return;
  }

  // ?trim= is ignored when the id is not in the loaded list, or when a second
  // loadVehicleDetails reset wins the race after hasPrefilled is set.
  if ((await lineupTrigger.count()) > 0) {
    await expect(lineupTrigger).toBeEnabled({ timeout: SLUG_WAIT_MS });
    await lineupTrigger.click();
    await pickFirstSheetOption(page, "라인업 선택");
  }

  await expect(trimTrigger).toBeEnabled({ timeout: SLUG_WAIT_MS });
  await trimTrigger.click();
  await pickFirstSheetOption(page, "트림 선택");

  await expect(calculateButton).toBeEnabled({ timeout: SLUG_WAIT_MS });
}

test.describe("견적 저장 더블클릭", () => {
  test("sends a single /api/quote/save request when the quote save control is double-clicked", async ({
    page,
  }) => {
    // Given: a public vehicle slug from the live catalog (SSR vehicle list)
    const vehicleSlug = await firstPublicVehicleSlug(page);
    test.skip(
      vehicleSlug === null,
      "No public vehicle slug on / or /cars — cannot mount the real /quote UI without a catalog row.",
    );
    if (vehicleSlug === null) return;

    let releaseSave = (): void => {};
    const saveReleased = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    await stubQuotePrerequisites(page, vehicleSlug);
    await stubQuoteSaveHeld(page, saveReleased);
    await page.addInitScript(() => {
      window.ChannelIO = () => undefined;
      document.documentElement.setAttribute("data-channel-talk-status", "ready");
    });

    await page.goto(
      `/quote?vehicle=${vehicleSlug}&customerType=individual&trim=${CONSULTATION_TRIM_ID}`,
      { waitUntil: "domcontentloaded" },
    );

    await ensureCalculateCtaReady(page);
    await page.getByRole("button", { name: CALCULATE_CTA_NAME }).click();

    const saveButton = page.getByRole("button", { name: "선택 조건으로 상담 요청하기" });
    await expect(saveButton).toBeVisible({ timeout: SLUG_WAIT_MS });
    await expect(saveButton).toBeEnabled();

    // Subscribe BEFORE the double-click. Held 200 matches savedQuoteResponseSchema
    // so the client does not retry.
    const saveRequests: Request[] = [];
    page.on("request", (request) => {
      if (isQuoteSavePost(request)) saveRequests.push(request);
    });
    const firstSave = page.waitForRequest(isQuoteSavePost, { timeout: SAVE_WAIT_MS });

    // When: the customer double-clicks the save control (no await between clicks)
    await saveButton.dblclick({ force: true });

    // Then: the browser issues exactly one POST /api/quote/save
    await firstSave;
    expect(saveRequests, "second click must not start another save POST").toHaveLength(1);
    releaseSave();
    await expect(saveButton).toBeEnabled({ timeout: SAVE_WAIT_MS });
    expect(saveRequests).toHaveLength(1);
  });
});
