import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReferralProgressItem } from "@/lib/referral/progress";
import { ReferralProgress } from "./ReferralProgress";

const items: ReferralProgressItem[] = [
  { id: "1", maskedName: "김*규", signedUpLabel: "2026.08.02", step: 4, isLost: false },
  { id: "2", maskedName: "박*영", signedUpLabel: "2026.08.10", step: 3, isLost: false },
  { id: "3", maskedName: "이*수", signedUpLabel: "2026.08.11", step: 2, isLost: true },
  { id: "4", maskedName: "최*민", signedUpLabel: "2026.08.12", step: 1, isLost: false },
];

describe("ReferralProgress", () => {
  it("renders nothing when there are no referrals", () => {
    const { container } = render(<ReferralProgress items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the funnel with ever-reached counts", () => {
    render(<ReferralProgress items={items} />);
    expect(screen.getByText("추천 전환 현황")).toBeInTheDocument();
    // 가입 4 · 견적 3 · 상담 2 · 계약 1
    const funnelValues = ["4", "3", "2", "1"];
    for (const label of ["가입", "견적", "상담", "계약"]) {
      const labelEl = screen.getAllByText(label)[0];
      const valueEl = labelEl.parentElement?.querySelector("p.tabular-nums");
      expect(valueEl?.textContent).toBe(funnelValues.shift());
    }
  });

  it("shows masked names, signup dates, and status badges", () => {
    render(<ReferralProgress items={items} />);
    expect(screen.getByText("김*규")).toBeInTheDocument();
    expect(screen.getByText("2026.08.02 가입")).toBeInTheDocument();
    expect(screen.getByText("계약 완료")).toBeInTheDocument();
    expect(screen.getByText("상담 중")).toBeInTheDocument();
    expect(screen.getByText("진행 중단")).toBeInTheDocument();
    expect(screen.getByText("가입 완료")).toBeInTheDocument();
  });

  it("exposes the step position for assistive tech", () => {
    render(<ReferralProgress items={items} />);
    expect(screen.getByLabelText("진행 단계: 4 / 4")).toBeInTheDocument();
    expect(screen.getByLabelText("진행 단계: 1 / 4")).toBeInTheDocument();
  });

  it("collapses and expands the referral list via the accordion header", () => {
    render(<ReferralProgress items={items} />);
    const toggle = screen.getByRole("button", { name: /추천 목록/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("김*규")).toBeVisible();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("김*규")).toBeVisible();
  });
});
