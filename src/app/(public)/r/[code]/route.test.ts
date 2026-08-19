import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.findFirst },
  },
}));

import { GET } from "./route";
import { REFERRAL_REDEEM_PATH } from "@/lib/referral/pending-code";

describe("GET /r/[code]", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    mocks.findFirst.mockReset();
    mocks.findFirst.mockResolvedValue({ id: "inviter-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends a valid code to login with mypage redeem as the return path", async () => {
    const response = await GET(
      new Request("https://app.example/r/K4821"),
      { params: Promise.resolve({ code: "K4821" }) },
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("ref")).toBe("K4821");
    expect(location.searchParams.get("next")).toBe(REFERRAL_REDEEM_PATH);
  });
});
