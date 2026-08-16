/**
 * [진단 전용] 견적 결과 배너 "월 납입금 0만원" 재현 테스트 — imdealer.co.kr 라이브 버그.
 *
 * 증상(2026-08-16 03:25 UTC, QuoteCalcLog session 9e1d5bc0…): 비회원 · 개인 · 장기렌트 ·
 * 테슬라 New Model Y Premium RWD(49,990,000원) · 60개월 · 연 2만km · 초기비용 있음(선납 30%)
 * 에서 결과 배너가 "0만원"으로 표시됐다.
 *
 * 서버 측은 정상임을 확인했다(라이브 API 응답 aggressive=500,400원, 계산 로그 standard=792,342원,
 * 활성 회수율 시트 전수 스캔에서 선납 30% 월납 ≤ 0 이 되는 셀 0건). 0원은 클라이언트가
 * "잠긴(locked) 시나리오"를 가격처럼 렌더한 것이다:
 *
 *  - 2026-08-15 커밋 7beb683 이 게이트 방향을 뒤집었다.
 *      구(舊) 정책: 비회원에게 standard(무보증) 공개, conservative·aggressive 잠금.
 *      신(新) 정책: aggressive(선납 30%) 공개, conservative·standard 잠금.
 *  - 응답과 클라이언트 번들의 정책 세대가 어긋나면(스테일 탭/캐시 번들 ↔ 새 API, 또는 배포 중 반대 방향)
 *    현재 클라이언트의 resolveQuoteResultScenario 는 `return aggressive ?? standard` 로
 *    잠긴 시나리오(monthlyPayment 0)를 그대로 돌려주고, TossPrice 는 Math.max(0, …) 로
 *    0/음수를 조용히 "0만원"으로 그린다 — 실패 안전장치가 없다.
 *
 * 아래 [RED] 테스트 2건은 의도적으로 실패 상태로 둔다(진단 산출물 — 수정 금지 지시).
 * 결과 화면 어디에도 "0만원"이 가격처럼 보이면 안 된다는 불변식을 검증한다.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuoteClientPageV2 } from "./QuoteClientPageV2";
import { vehicles } from "./QuoteClientPageV2.test-fixtures";
import type { QuoteResponse } from "@/types/api";

type MockAuthUser = { readonly id: string } | null;

const navigationMock = vi.hoisted(() => ({
  router: { back: vi.fn(), push: vi.fn(), replace: vi.fn() },
  searchParams: new URLSearchParams(
    "vehicle=preparing-car&customerType=individual&trim=trim-preparing",
  ),
}));

const supabaseMock = vi.hoisted(() => ({
  getUser: vi.fn<() => Promise<{ readonly data: { readonly user: MockAuthUser } }>>(
    async () => ({ data: { user: null } }),
  ),
  signInWithOAuth: vi.fn(async () => ({
    data: { provider: "kakao", url: null },
    error: null,
  })),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMock.router,
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock("next/image", () => ({ default: () => null }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: supabaseMock.getUser,
      signInWithOAuth: supabaseMock.signInWithOAuth,
      onAuthStateChange: supabaseMock.onAuthStateChange,
    },
  }),
}));

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubEnv("NEXT_PUBLIC_KAKAO_SYNC", "true");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
  supabaseMock.getUser.mockReset();
  supabaseMock.getUser.mockResolvedValue({ data: { user: null } });
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  navigationMock.searchParams = new URLSearchParams(
    "vehicle=preparing-car&customerType=individual&trim=trim-preparing",
  );
});

/** gateQuoteScenariosForGuest / lockQuoteScenario 가 만드는 잠금 시나리오 실측 형태. */
function lockedScenario() {
  return {
    monthlyPayment: 0,
    depositAmount: 0,
    prepayAmount: 0,
    contractMonths: 60,
    annualMileage: 20000,
    contractType: "반납형",
    bestFinanceCompany: "",
    purchaseSurcharge: 0,
    breakdown: null,
    surcharges: null,
    allFinanceResults: [],
    rangeExceeded: false,
    locked: true,
  };
}

const RESPONSE_META = {
  vehicleSlug: "preparing-car",
  trimId: "trim-preparing",
  trimName: "프리미엄",
  // 실측 재현 조건: 테슬라 New Model Y Premium RWD 49,990,000원 (총 차량가 4,999만원)
  trimPrice: 49_990_000,
  discountPrice: null,
  discountAmount: 0,
  optionsTotalPrice: 0,
  colorDelta: 0,
  totalVehiclePrice: 49_990_000,
  contractMonths: 60,
  annualMileage: 20000,
  contractType: "반납형",
  customerType: "individual",
} as const;

/**
 * 신(현행) 게이트 응답 — 2026-08-16 라이브 API 실측값 그대로.
 * (POST /api/vehicles/tesla-11738/quote, 비회원, 60개월/2만km/장기렌트)
 */
function currentGuestGatedResponse(): QuoteResponse {
  return {
    ...RESPONSE_META,
    scenarios: {
      conservative: lockedScenario(),
      standard: lockedScenario(),
      aggressive: {
        monthlyPayment: 500_400,
        depositAmount: 0,
        prepayAmount: 14_997_000,
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        bestFinanceCompany: "롯데캐피탈",
        purchaseSurcharge: 0,
        breakdown: {
          vehiclePrice: 49_990_000,
          recoveryRate: 0.01565,
          baseMonthly: 782_343.5,
          depositAmount: 0,
          prepayAmount: 14_997_000,
          depositDiscount: 0,
          prepayAdjust: -291_941.6,
          monthlyBeforeSurcharge: 490_401.9,
        },
        surcharges: {
          rankSurcharge: 9_998,
          vehicleSurcharge: 0,
          financeSurcharge: 0,
          totalSurcharge: 9_998,
        },
        rangeExceeded: false,
        allFinanceResults: [],
      },
    },
    requiresConsultation: false,
  } as unknown as QuoteResponse;
}

/**
 * 구(2026-08-15 이전, 커밋 7beb683 이전) 게이트 응답 형태 — standard 공개, aggressive 잠금.
 * standard 금액 792,342원은 동일 조건 QuoteCalcLog 실측값. 배포 전후 스큐(스테일 번들 ↔ 새 API,
 * 혹은 새 번들 ↔ 롤백/구 API) 상황에서 현재 클라이언트가 실제로 받을 수 있는 모양이다.
 */
function legacyGuestGatedResponse(): QuoteResponse {
  return {
    ...RESPONSE_META,
    scenarios: {
      conservative: lockedScenario(),
      standard: {
        monthlyPayment: 792_342,
        depositAmount: 0,
        prepayAmount: 0,
        contractMonths: 60,
        annualMileage: 20000,
        contractType: "반납형",
        bestFinanceCompany: "롯데캐피탈",
        purchaseSurcharge: 0,
        breakdown: null,
        surcharges: null,
        allFinanceResults: [],
        rangeExceeded: false,
      },
      aggressive: lockedScenario(),
    },
    requiresConsultation: false,
  } as unknown as QuoteResponse;
}

function freshFlowFetchMock(quoteResponse: QuoteResponse) {
  return vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input) => {
      const url = input.toString();
      if (url.endsWith("/colors")) {
        return Response.json({ success: true, data: [] });
      }
      if (url.endsWith("/trims")) {
        return Response.json({
          success: true,
          data: [
            {
              id: "trim-preparing",
              name: "프리미엄",
              price: 49_990_000,
              discountPrice: null,
              evSubsidy: null,
              engineType: "EV",
              fuelEfficiency: 5,
              isDefault: true,
              specs: null,
              options: [],
              rules: [],
              lineupId: null,
              lineup: null,
              availableProducts: ["장기렌트", "리스"],
            },
          ],
        });
      }
      if (url.endsWith("/quote")) {
        return Response.json({ success: true, data: quoteResponse });
      }
      return Response.json({ success: false, error: "unexpected request" }, { status: 500 });
    },
  );
}

const isZeroManwon = (_: string, node: Element | null) => node?.textContent === "0만원";

describe("견적 결과 0만원 진단 (Tesla New Model Y Premium RWD · 60개월 · 2만km · 선납 30%)", () => {
  it("[대조군·통과] 현행 게이트 응답이면 비회원 첫 화면은 선납 30% 실제 금액을 보여준다", async () => {
    vi.stubGlobal("fetch", freshFlowFetchMock(currentGuestGatedResponse()));

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(await screen.findByRole("button", { name: "월 납입금 확인하기" }));

    // 라이브 API 실측값 500,400원 → "50만400원"
    expect(
      await screen.findByText((_, node) => node?.textContent === "50만400원"),
    ).toBeInTheDocument();
    expect(screen.queryAllByText(isZeroManwon)).toHaveLength(0);
  });

  it("[RED·증상 재현] 정책 세대가 어긋난 응답(aggressive 잠김)이면 잠긴 시나리오가 '0만원' 가격으로 렌더된다", async () => {
    vi.stubGlobal("fetch", freshFlowFetchMock(legacyGuestGatedResponse()));

    render(<QuoteClientPageV2 vehicles={vehicles} />);
    fireEvent.click(await screen.findByRole("button", { name: "월 납입금 확인하기" }));
    await screen.findByRole("button", { name: "조건 다시 설정하기" });

    // 불변식: 결과 화면 어디에도 "0만원"이 가격처럼 보이면 안 된다.
    // 현재 구현은 resolveQuoteResultScenario 의 `return aggressive ?? standard` 가
    // 잠긴 aggressive(0원)를 돌려주고 TossPrice 가 이를 "0만원"으로 그려 실패한다(의도된 RED).
    expect(screen.queryAllByText(isZeroManwon)).toHaveLength(0);
    // 참고: 응답에는 standard 792,342원이 멀쩡히 실려 있었다.
  });

  it("[RED·2차 경로] 비공개 비율(보증금 10%) 복원 상태의 비회원 재계산도 잠긴 standard 를 '0만원'으로 렌더한다", async () => {
    navigationMock.searchParams = new URLSearchParams(
      "vehicle=preparing-car&customerType=individual&restore=1",
    );
    // 회원 시절 저장했거나 세션이 만료된 스냅샷: customRates {deposit 10, prepay 0}
    window.localStorage.setItem(
      "quote_image_restore",
      JSON.stringify({
        vehicleSlug: "preparing-car",
        customerType: "individual",
        selectedLineup: null,
        selectedTrimName: "프리미엄",
        selectedOptionIds: [],
        contractCategory: "장기렌트",
        conditions: { contractMonths: 60, annualMileage: 20000, contractType: "반납형" },
        customRates: { depositRate: 10, prepayRate: 0 },
        costMode: "initial",
        baseStandard: null,
        quoteResult: {
          ...RESPONSE_META,
          scenarios: {
            conservative: lockedScenario(),
            // 스냅샷 당시(회원) 보증금 10% 적용 standard
            standard: {
              monthlyPayment: 754_270,
              depositAmount: 4_999_000,
              prepayAmount: 0,
              contractMonths: 60,
              annualMileage: 20000,
              contractType: "반납형",
              bestFinanceCompany: "롯데캐피탈",
              purchaseSurcharge: 0,
              breakdown: null,
              surcharges: null,
              allFinanceResults: [],
              rangeExceeded: false,
            },
            aggressive: currentGuestGatedResponse().scenarios.aggressive,
          },
          requiresConsultation: false,
        },
      }),
    );
    // 복원 직후 500ms 디바운스 재계산이 실제(현행) 게이트 응답을 받는다:
    // 비회원 + 비공개 비율(10/0) → standard 잠금(keepStandardUnlocked=false).
    const fetchMock = freshFlowFetchMock(currentGuestGatedResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<QuoteClientPageV2 vehicles={vehicles} />);

    // 복원 직후에는 스냅샷 standard(75만4,270원)가 보인다.
    await screen.findByText((_, node) => node?.textContent === "75만4,270원");

    // 디바운스 재계산이 잠긴 standard 로 교체될 때까지 대기.
    await waitFor(
      () => {
        const quoteCalls = fetchMock.mock.calls.filter(([input]) =>
          input.toString().endsWith("/quote"),
        );
        expect(quoteCalls.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // 불변식: 잠긴 시나리오 금액(0원)을 가격처럼 렌더하면 안 된다 — 현재 구현은 실패한다(의도된 RED).
    await waitFor(
      () => {
        expect(screen.queryAllByText(isZeroManwon)).toHaveLength(0);
      },
      { timeout: 2000 },
    );
  });
});
