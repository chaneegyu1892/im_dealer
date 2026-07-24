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
} satisfies RecommendResultResponse;

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
});
