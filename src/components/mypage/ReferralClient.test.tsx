import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { REFERRAL_REDEEM_PATH } from "@/lib/referral/pending-code";
import { ReferralClient } from "./ReferralClient";

describe("ReferralClient logged-in code guidance", () => {
  it("points an already-joined member to the mypage redeem surface", () => {
    render(
      <ReferralClient
        code="K4821"
        shareUrl="https://example.com/r/K4821"
        monthCount={1}
        monthCap={10}
        totalCount={1}
        memberName="홍길동"
        progressItems={[]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "쿠폰함에서 입력" }),
    ).toHaveAttribute("href", REFERRAL_REDEEM_PATH);
  });
});
