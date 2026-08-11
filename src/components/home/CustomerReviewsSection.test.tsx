import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicReview } from "@/types/review";
const reducedMotion = vi.hoisted(() => ({ enabled: false }));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotion.enabled,
}));

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
  {
    id: "review-3",
    displayName: "이○○님",
    rating: 5,
    content: "세 번째 후기입니다.",
    vehicleId: null,
    vehicleName: null,
    vehicleBrand: null,
    reviewDate: "2026.07",
    imageUrls: [],
    isBest: false,
    likeCount: 6,
  },
];

/** transform 문자열에서 translateX(px) 수치 추출. */
function translateXOf(el: HTMLElement | null): number {
  const m = el?.style.transform.match(/translate3d\((-?[\d.]+)(?:px)?,/);
  return m ? Number(m[1]) : 0;
}

describe("CustomerReviewsSection 연속 슬라이드", () => {
  beforeEach(() => {
    reducedMotion.enabled = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderSection(reviewSlice = reviews) {
    const view = render(<CustomerReviewsSection reviews={reviewSlice} />);
    const track = view.container.querySelector<HTMLElement>(".will-change-transform");
    const carousel = track?.parentElement;
    if (!track || !carousel) throw new Error("리뷰 캐러셀이 렌더되지 않음");
    return { ...view, track, carousel };
  }

  it("시간이 흐르면 트랙이 왼쪽으로 부드럽게 연속 이동한다", () => {
    const { track } = renderSection();
    expect(translateXOf(track)).toBe(0);

    // 45px/s * 5s = 225px. fake timer rAF 가 프레임별로 누적 합산.
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const x = translateXOf(track);
    expect(Number.isFinite(x)).toBe(true);
    expect(x).toBeLessThan(-150); // 분명히 왼쪽으로 이동
    expect(x).toBeGreaterThan(-320); // 한 세트 폭 이내
  });

  it("hover/focus 시 드리프트가 멈추고, 해제되면 다시 흐른다", () => {
    const { carousel, track } = renderSection();

    act(() => {
      fireEvent.mouseEnter(carousel);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(translateXOf(track)).toBe(0); // 멈춤

    act(() => {
      fireEvent.mouseLeave(carousel);
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(translateXOf(track)).toBeLessThan(-100); // 다시 흐름

    const beforeFocus = translateXOf(track);
    act(() => {
      fireEvent.focus(carousel);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(translateXOf(track)).toBe(beforeFocus); // focus 에도 멈춤
  });

  it("수동 버튼은 한 칸을 이동하고, resize 시 첫 카드로 재정렬한다", () => {
    const { track, carousel } = renderSection(reviews.slice(0, 2));
    const cards = track.querySelectorAll<HTMLElement>("article");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    Object.defineProperty(cards[0], "offsetLeft", { configurable: true, value: 0 });
    Object.defineProperty(cards[1], "offsetLeft", { configurable: true, value: 268 });

    // hover 로 드리프트를 멈춘 뒤 버튼 트윈만 관찰(결정성).
    act(() => {
      fireEvent.mouseEnter(carousel);
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "다음 후기" }));
    });
    act(() => {
      vi.advanceTimersByTime(500); // 트윈(380ms) 완료
    });
    expect(translateXOf(track)).toBe(-268);

    act(() => {
      fireEvent(window, new Event("resize"));
    });
    expect(translateXOf(track)).toBe(0);
  });

  it("reduced motion 에서는 자동 드리프트가 동작하지 않는다", () => {
    reducedMotion.enabled = true;
    const { track } = renderSection();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(translateXOf(track)).toBe(0);
  });
});
