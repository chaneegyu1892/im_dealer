import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroSectionV2 } from "./HeroSectionV2";

describe("HeroSectionV2", () => {
  it("makes AI recommendation the first primary action", () => {
    // Given
    render(<HeroSectionV2 />);

    // When
    const aiRecommendationLink = screen.getByRole("link", {
      name: "AI 추천 받기",
    });
    const quoteCarsLink = screen.getByRole("link", {
      name: "내 차량 견적내기",
    });

    // Then
    expect(
      aiRecommendationLink.compareDocumentPosition(quoteCarsLink),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(aiRecommendationLink).toHaveClass("bg-brand", "text-white");
    expect(quoteCarsLink).not.toHaveClass("bg-brand", "text-white");
  });

  it("renders 견적 CTA with /cars destination and brand ring", () => {
    // Given
    render(<HeroSectionV2 />);

    // When
    const quoteCarsLink = screen.getByRole("link", {
      name: "내 차량 견적내기",
    });

    // Then
    expect(quoteCarsLink).toHaveAttribute("href", "/cars");
    expect(quoteCarsLink).toHaveClass("bg-surface-soft");
    expect(quoteCarsLink).toHaveClass("ring-brand/30");
  });
});
