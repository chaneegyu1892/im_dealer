import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_REFERRAL_STORAGE_KEY,
  REFERRAL_REDEEM_PATH,
} from "@/lib/referral/pending-code";

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigation.searchParams,
}));

import { ReferralLandingNotice } from "./ReferralLandingNotice";

describe("ReferralLandingNotice", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    navigation.searchParams = new URLSearchParams("ref=k4821");
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("persists a home ?ref= code and points at mypage redeem", async () => {
    render(<ReferralLandingNotice />);

    const login = await screen.findByRole("link", { name: "쿠폰함에서 입력" });
    expect(window.sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)).toBe(
      "K4821",
    );
    const href = new URL(login.getAttribute("href") ?? "", "https://app.example");
    expect(href.pathname).toBe("/login");
    expect(href.searchParams.get("next")).toBe(REFERRAL_REDEEM_PATH);
    expect(href.searchParams.get("ref")).toBe("K4821");
  });

  it("does not invent a CTA for an invalid ref marker", () => {
    navigation.searchParams = new URLSearchParams("ref=invalid");
    render(<ReferralLandingNotice />);
    expect(screen.queryByRole("link", { name: "쿠폰함에서 입력" })).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)).toBeNull();
  });
});
