import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "./route";

function requestFor(code: string): { request: NextRequest; params: Promise<{ code: string }> } {
  return {
    request: new NextRequest(`https://example.com/r/${code}`),
    params: Promise.resolve({ code }),
  };
}

describe("GET /r/[code]", () => {
  it("valid code sets the httpOnly referral cookie and redirects to /", async () => {
    const { request, params } = requestFor("A1234");
    const response = await GET(request, { params });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("imdealer_ref=A1234");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie.toLowerCase()).toContain("max-age=2592000");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/");
  });

  it.each(["x", "abcd", "12345"])(
    "invalid code %s does not set a cookie but still redirects to /",
    async (code) => {
      const { request, params } = requestFor(code);
      const response = await GET(request, { params });

      expect(response.headers.get("set-cookie") ?? "").not.toContain("imdealer_ref");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://example.com/");
    }
  );
});
