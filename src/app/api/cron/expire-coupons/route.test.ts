import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  timingSafeEqualString: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { issuedCoupon: { updateMany: mocks.updateMany } },
}));
vi.mock("@/lib/security", () => ({
  timingSafeEqualString: mocks.timingSafeEqualString,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import { POST } from "./route";

function request(authorization?: string): NextRequest {
  return new NextRequest("https://example.com/api/cron/expire-coupons", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("POST /api/cron/expire-coupons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.updateMany.mockResolvedValue({ count: 7 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the cron bearer secret", async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("expires HELD coupons past their expiresAt", async () => {
    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, expired: 7 });

    // reconcile(rules.ts) 의 만료 분기와 동일하게 HELD 만 스윕한다.
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { status: "HELD", expiresAt: { lte: expect.any(Date) } },
      data: { status: "EXPIRED" },
    });
  });

  it("reports 500 and alerts Sentry when the sweep throws", async () => {
    mocks.updateMany.mockRejectedValue(new Error("db down"));

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { cron: "expire-coupons" } })
    );
  });
});
