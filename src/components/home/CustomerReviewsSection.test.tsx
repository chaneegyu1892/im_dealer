import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("CustomerReviewsSection 좁은 모바일", () => {
  it("실제 카드 간격만큼 이동하고 화면 폭이 바뀌면 첫 카드로 재정렬한다", () => {
    const { container } = render(<CustomerReviewsSection reviews={reviews} />);
    const track = container.querySelector<HTMLElement>(".will-change-transform");
    const cards = track?.querySelectorAll<HTMLElement>("article");

    expect(track).not.toBeNull();
    expect(cards?.length).toBeGreaterThanOrEqual(2);
    if (!track || !cards || cards.length < 2) return;

    Object.defineProperty(cards[0], "offsetLeft", { configurable: true, value: 0 });
    Object.defineProperty(cards[1], "offsetLeft", { configurable: true, value: 268 });

    fireEvent.click(screen.getByRole("button", { name: "다음 후기" }));
    expect(track.style.transform).toBe("translate3d(-268px, 0, 0)");

    fireEvent(window, new Event("resize"));
    expect(track.style.transform).toBe("translate3d(0, 0, 0)");
  });
});
