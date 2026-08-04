import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RecommendResultResponse } from "@/types/recommendation";
import { recommendRequestSchema } from "@/lib/recommend/recommend-request";

const mocks = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => new URLSearchParams("session=test-session"),
}));

vi.mock("./RecommendVehicleCard", () => ({
  RecommendVehicleCard: ({ vehicle }: { vehicle: { rank: number } }) => (
    <article data-testid={`recommend-card-${vehicle.rank}`}>
      {vehicle.rank}순위 추천
    </article>
  ),
}));

vi.mock("@/components/ui/TrustBadge", () => ({
  TrustBadgeGroup: () => null,
}));

import { RecommendResultView } from "./RecommendResultView";

const recommendResult = {
  sessionId: "test-session",
  input: {
    industry: "개인",
    purpose: "출퇴근",
    annualMileage: 20_000,
    returnType: "반납형",
    budgetRange: "lte-500k",
    fuelPreference: "하이브리드",
  },
  vehicles: [1, 2, 3].map((rank) => ({
    vehicleId: `vehicle-${rank}`,
    rank,
  })),
  nearMissVehicles: [],
} as unknown as RecommendResultResponse;

const emptyRecommendResult = {
  sessionId: "empty-session",
  input: {
    industry: "개인",
    purpose: "family-leisure, 가족",
    preferences: ["family-leisure", "가족"],
    stylePreference: "family-leisure",
    situationPreference: "가족",
    childDetail: "미취학",
    annualMileage: 30_000,
    returnType: "미정",
    budgetRange: "lte-500k",
    fuelPreference: "전기차",
    chargingEnvironment: "자택",
    residenceRegion: "제주",
  },
  vehicles: [],
  nearMissVehicles: [],
} satisfies RecommendResultResponse;

function nearMiss(name: string, estimatedMonthly: number, rank: number) {
  return {
    vehicleId: `near-${rank}`,
    rank,
    estimatedMonthly,
    vehicle: { name, brand: "현대", slug: `slug-${rank}` },
    popularity: { period: "2026-06", rank: 5, registrationCount: 1_000 },
  };
}

const nearMissResult = {
  ...emptyRecommendResult,
  nearMissVehicles: [
    nearMiss("더 뉴 아이오닉 5", 624_000, 1),
    nearMiss("더 EV5", 635_000, 2),
  ],
} as unknown as RecommendResultResponse;

describe("RecommendResultView", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => recommendResult,
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("3순위 추천 뒤에 차량 탐색 CTA를 제공한다", async () => {
    render(<RecommendResultView />);

    const browseCarsLink = await screen.findByRole("link", {
      name: "차량 탐색하기",
    });
    const thirdRankedCard = screen.getByTestId("recommend-card-3");

    expect(screen.getByText("원하시는 차량이 안나왔나요?")).toBeInTheDocument();
    expect(browseCarsLink).toHaveAttribute("href", "/cars");
    expect(
      thirdRankedCard.compareDocumentPosition(browseCarsLink)
        & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.queryByText("조건 바꿔서 다시 추천받기")).not.toBeInTheDocument();
  });

  it("추천 결과가 없으면 기존 답변을 유지하고 예산만 바꿔 재추천한다", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => emptyRecommendResult,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: "retry-session", vehicles: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<RecommendResultView />);

    expect(await screen.findByText("월 납입금 예산을 바꿔볼까요?")).toBeInTheDocument();
    expect(screen.getByText("앞에서 선택한 다른 답변은 그대로 유지됩니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "조건 다시 설정하기" })).not.toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "예산 바꿔 다시 추천받기" });
    expect(retryButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /80만원 이하/ }));
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const retryCall = fetchMock.mock.calls[1];
    const retryPayload = JSON.parse(String(retryCall?.[1]?.body));

    expect(retryCall?.[0]).toBe("/api/recommend");
    expect(retryCall?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(retryPayload).toMatchObject({
      recommendationVersion: "step02-v3",
      industry: "개인",
      budgetRange: "lte-800k",
      preferences: ["family-leisure", "가족"],
      stylePreference: "family-leisure",
      situationPreference: "가족",
      childDetail: "미취학",
      annualMileage: 30_000,
      returnType: "미정",
      fuelPreference: "전기차",
      chargingEnvironment: "자택",
      residenceRegion: "제주",
    });
    expect(retryPayload).not.toHaveProperty("budgetMin");
    expect(retryPayload).not.toHaveProperty("budgetMax");
    expect(recommendRequestSchema.safeParse(retryPayload).success).toBe(true);
    await waitFor(() => {
      expect(mocks.router.push).toHaveBeenCalledWith(
        "/recommend/result?session=retry-session"
      );
    });
  });

  // 예산 하나 때문에 잘린 차를 감추면 사용자는 "그냥 고장났다"고 읽는다.
  // 조건에 못 맞췄다고 먼저 밝히고 대안을 보여줘야 신뢰가 유지된다.
  describe("근접 후보 안내", () => {
    it("예산을 조금 넘긴 차량과 초과 금액을 함께 알린다", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => nearMissResult,
      }));

      render(<RecommendResultView />);

      expect(await screen.findByText("조금만 더 쓰면 가능한 차량")).toBeInTheDocument();
      expect(screen.getByText("더 뉴 아이오닉 5")).toBeInTheDocument();
      expect(screen.getByText("더 EV5")).toBeInTheDocument();
      expect(screen.getByText(/12만 4,000원 더/)).toBeInTheDocument();
      expect(screen.getByText(/13만 5,000원 더/)).toBeInTheDocument();
    });

    it("조건을 못 맞췄다는 사실을 근접 후보보다 먼저 밝힌다", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => nearMissResult,
      }));

      render(<RecommendResultView />);

      const heading = await screen.findByText("추천 결과가 없어요");
      const nearMissTitle = screen.getByText("조금만 더 쓰면 가능한 차량");
      expect(
        heading.compareDocumentPosition(nearMissTitle)
          & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("근접 후보가 없으면 섹션을 띄우지 않는다", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => emptyRecommendResult,
      }));

      render(<RecommendResultView />);

      expect(await screen.findByText("추천 결과가 없어요")).toBeInTheDocument();
      expect(screen.queryByText("조금만 더 쓰면 가능한 차량")).not.toBeInTheDocument();
    });

    it("추천 결과가 있으면 근접 후보를 섞지 않는다", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...recommendResult,
          nearMissVehicles: nearMissResult.nearMissVehicles,
        }),
      }));

      render(<RecommendResultView />);

      expect(await screen.findByTestId("recommend-card-1")).toBeInTheDocument();
      expect(screen.queryByText("조금만 더 쓰면 가능한 차량")).not.toBeInTheDocument();
    });
  });
});
