import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteConditionDialog } from "./QuoteConditionDialog";
import type { MyPageQuote } from "@/lib/member-queries/mypage";

const quote: MyPageQuote = {
  id: "quote-1",
  sessionId: "session-1",
  vehicleSlug: "sorento",
  vehicleName: "쏘렌토",
  vehicleBrand: "기아",
  thumbnailUrl: null,
  trimId: "trim-1",
  trimName: "시그니처",
  selectedOptionIds: ["option-1"],
  selectedOptions: [{ id: "option-1", name: "드라이브 와이즈", price: 1_290_000 }],
  exteriorColor: { name: "스노우 화이트 펄", priceDelta: 80_000 },
  interiorColor: { name: "블랙", priceDelta: 0 },
  totalVehiclePrice: 46_720_000,
  productType: "장기렌트",
  contractType: "반납형",
  customerType: "individual",
  contractMonths: 48,
  annualMileage: 20_000,
  depositRate: 10,
  prepayRate: 0,
  monthlyPayment: 560_000,
  pricingStatus: "CALCULATED",
  status: "CONTACTED",
  statusInfo: {
    label: "상담 진행",
    description: "담당자와 조건을 조율하고 있어요.",
    tone: "warning",
    progressIndex: 1,
  },
  createdAt: new Date("2026-07-24T03:00:00.000Z"),
  updatedAt: new Date("2026-07-24T03:00:00.000Z"),
  expiresAt: new Date("2026-08-07T03:00:00.000Z"),
  delivery: null,
};

describe("QuoteConditionDialog", () => {
  it("저장된 견적 조건을 모달에서 보여주고 조건 변경은 별도 행동으로 제공한다", () => {
    render(
      <QuoteConditionDialog
        quote={quote}
        quoteHref="/quote?vehicle=sorento&trim=trim-1"
        className="test-trigger"
      />
    );

    const trigger = screen.getByRole("button", { name: "견적 조건 보기" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "견적 조건" })).toBeInTheDocument();
    expect(screen.getByText("기아 쏘렌토")).toBeInTheDocument();
    expect(screen.getByText("드라이브 와이즈")).toBeInTheDocument();
    expect(screen.getByText("스노우 화이트 펄")).toBeInTheDocument();
    expect(screen.getByText("블랙")).toBeInTheDocument();
    expect(screen.getByText("46,720,000원")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "조건 변경 후 새 견적 받기" })).toHaveAttribute(
      "href",
      "/quote?vehicle=sorento&trim=trim-1"
    );
  });
});
