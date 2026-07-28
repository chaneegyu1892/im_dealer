import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  timingSafeEqualString: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/quote-delivery/lifecycle", () => ({
  cleanupExpiredQuoteImages: mocks.cleanup,
}));
vi.mock("@/lib/security", () => ({
  timingSafeEqualString: mocks.timingSafeEqualString,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import { POST } from "./route";

const cutoff = new Date("2026-07-21T00:00:00.000Z");

function request(authorization?: string): NextRequest {
  return new NextRequest("https://example.com/api/cron/purge-quote-images", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("POST /api/cron/purge-quote-images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.cleanup.mockResolvedValue({
      cutoff,
      retentionDays: 7,
      scanned: 3,
      deleted: 3,
      failures: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires the cron bearer secret", async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });

  it("runs bounded image cleanup and reports the retention window", async () => {
    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      cutoff: cutoff.toISOString(),
      retentionDays: 7,
      scanned: 3,
      deleted: 3,
      failures: [],
    });
  });

  it("returns 500 and emits an alert when an object remains undeleted", async () => {
    mocks.cleanup.mockResolvedValue({
      cutoff,
      retentionDays: 7,
      scanned: 2,
      deleted: 1,
      failures: [{ id: "delivery-retry", reason: "storage unavailable" }],
    });

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Quote image cleanup incomplete",
      deleted: 1,
      failures: [{ id: "delivery-retry", reason: "storage unavailable" }],
    });
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { cron: "purge-quote-images" } })
    );
  });
});
