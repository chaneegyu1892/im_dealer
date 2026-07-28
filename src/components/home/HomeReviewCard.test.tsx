import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicReview } from "@/types/review";
import { HomeReviewCard } from "./HomeReviewCard";

const review: PublicReview = {
  id: "review-1",
  displayName: "김○○님",
  rating: 5,
  content: "좁은 모바일에서도 후기 전체를 편하게 읽을 수 있었어요.",
  vehicleId: null,
  vehicleName: null,
  vehicleBrand: null,
  reviewDate: "2026.07",
  imageUrls: [],
  isBest: true,
  likeCount: 42,
};

describe("HomeReviewCard 좁은 모바일", () => {
  it("320px 고정폭 대신 뷰포트 안에서 줄어드는 최대폭을 사용한다", () => {
    render(
      <HomeReviewCard
        review={review}
        showImages={false}
        showBestBadge
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toHaveClass(
      "w-[calc(100vw-32px)]",
      "max-w-[320px]",
    );
  });
});
