import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/rate-limit", () => ({
  apiRateLimit: null,
  strictRateLimit: null,
}));

vi.mock("@/lib/vehicle-images/e2e-admin-session", () => ({
  getVehicleImageE2EAdmin: vi.fn(async () => null),
  VEHICLE_IMAGE_E2E_ADMIN_COOKIE: "vehicle_image_e2e_admin",
}));

import middleware from "./proxy";

function request(url: string): NextRequest {
  return new NextRequest(new URL(url, "https://example.com"), { method: "GET" });
}

describe("proxy middleware — referral ?ref= fallback", () => {
  it("valid ref sets httpOnly cookie and strips ref from the redirect URL", async () => {
    const response = await middleware(request("https://example.com/?ref=A1234"));

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("imdealer_ref=A1234");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).searchParams.get("ref")).toBeNull();
  });

  it("invalid ref does not set a cookie and leaves the URL unchanged", async () => {
    const response = await middleware(request("https://example.com/?ref=invalid"));

    expect(response.headers.get("set-cookie") ?? "").not.toContain("imdealer_ref");
    // no referral redirect issued for an invalid code
    expect(response.status).not.toBe(307);
  });

  it("does not touch /_next asset requests even with a valid ref", async () => {
    const response = await middleware(
      request("https://example.com/_next/static/chunk.js?ref=A1234")
    );

    expect(response.headers.get("set-cookie") ?? "").not.toContain("imdealer_ref");
  });

  it("does not touch /api requests even with a valid ref", async () => {
    const response = await middleware(
      request("https://example.com/api/some-route?ref=A1234")
    );

    expect(response.headers.get("set-cookie") ?? "").not.toContain("imdealer_ref");
  });
});
