import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicReview } from "@/types/review";
import { CustomerReviewsSection } from "./CustomerReviewsSection";

const reviews: PublicReview[] = [
  {
    id: "review-1",
    displayName: "김○○님",
    rating: 5,
    content: "첫 번째 후기입니다.",
    vehicleId: null,
    vehicleName: null,
    vehicleBrand: null,
    reviewDate: "2026.07",
    imageUrls: [],
    isBest: true,
    likeCount: 10,
  },
  {
    id: "review-2",
    displayName: "박○○님",
    rating: 5,
    content: "두 번째 후기입니다.",
    vehicleId: null,
    vehicleName: null,
    vehicleBrand: null,
    reviewDate: "2026.07",
    imageUrls: [],
    isBest: false,
    likeCount: 8,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: true, // reduced-motion → rAF 자동 스크롤 off, 수동 버튼만 검증
      media: "",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CustomerReviewsSection", () => {
  it("수동 버튼으로 카드 간격만큼 이동하고 resize 시 처음으로 되돌린다", () => {
    const { container } = render(<CustomerReviewsSection reviews={reviews} />);
    const track = container.querySelector<HTMLElement>(".will-change-transform");
    const cards = track?.querySelectorAll<HTMLElement>("article");

    expect(track).not.toBeNull();
    expect(cards?.length).toBeGreaterThanOrEqual(2);
    if (!track || !cards || cards.length < 2) return;

    Object.defineProperty(cards[0], "offsetLeft", { configurable: true, value: 0 });
    Object.defineProperty(cards[1], "offsetLeft", { configurable: true, value: 268 });
    // 원본 2장 세트 너비 ≈ 536, 복제 포함 scrollWidth ≈ 1072
    Object.defineProperty(track, "scrollWidth", { configurable: true, value: 1072 });

    fireEvent.click(screen.getByRole("button", { name: "다음 후기" }));
    expect(track.style.transform).toMatch(/translate3d\(-268px,\s*0(px)?,\s*0(px)?\)/);

    fireEvent(window, new Event("resize"));
    expect(track.style.transform).toMatch(/translate3d\(0(px)?,\s*0(px)?,\s*0(px)?\)/);
  });
});

