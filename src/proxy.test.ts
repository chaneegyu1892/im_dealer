import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTrustedClientIp: vi.fn(),
  apiLimit: vi.fn(),
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  prismaFindUnique: vi.fn(),
  getVehicleImageE2EAdmin: vi.fn(),
}));

vi.mock("@/lib/client-ip", () => ({
  getTrustedClientIp: mocks.getTrustedClientIp,
}));

vi.mock("@/lib/rate-limit", () => ({
  apiRateLimit: { limit: mocks.apiLimit },
  strictRateLimit: { limit: mocks.apiLimit },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.prismaFindUnique } },
}));

vi.mock("@/lib/vehicle-images/e2e-admin-session", () => ({
  VEHICLE_IMAGE_E2E_ADMIN_COOKIE: "vehicle_image_e2e_admin",
  getVehicleImageE2EAdmin: mocks.getVehicleImageE2EAdmin,
}));

function request(pathname: string, hostname = "imdealer.com"): NextRequest {
  return new NextRequest(`https://${hostname}${pathname}`, {
    method: "GET",
    headers: { host: hostname },
  });
}

describe("proxy rate-limit IP gate (T38/C3+C10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-tests");
    mocks.getTrustedClientIp.mockReturnValue(null);
    mocks.apiLimit.mockResolvedValue({
      success: true,
      limit: 40,
      remaining: 39,
      reset: Date.now() + 10_000,
    });
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.getVehicleImageE2EAdmin.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not 400 production API traffic when the client IP is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { default: middleware } = await import("./proxy");

    const response = await middleware(request("/api/quote/save"));

    expect(response.status).not.toBe(400);
    expect(mocks.apiLimit).toHaveBeenCalledWith("unknown");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown"),
      expect.anything(),
    );
    warn.mockRestore();
  });

  it("skips the IP rate-limit gate for /api/cron/* (Vercel cron has no XFF)", async () => {
    const { default: middleware } = await import("./proxy");

    const response = await middleware(request("/api/cron/outbound-sweep"));

    expect(response.status).not.toBe(400);
    expect(mocks.apiLimit).not.toHaveBeenCalled();
    expect(mocks.getTrustedClientIp).not.toHaveBeenCalled();
  });
});
