import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CarDetailRecommendBanner } from "./CarDetailRecommendBanner";

describe("CarDetailRecommendBanner", () => {
  it("keeps the Korean auxiliary phrase together on a narrow line", () => {
    render(<CarDetailRecommendBanner />);

    const heading = screen.getByRole("heading", {
      name: "나에게 맞는 차량이 따로 있을 수 있어요",
    });
    const auxiliaryPhrase = within(heading).getByText("있을 수 있어요");

    expect(auxiliaryPhrase).toHaveClass("whitespace-nowrap");
    expect(heading).toHaveTextContent("나에게 맞는 차량이 따로 있을 수 있어요");
  });
});
