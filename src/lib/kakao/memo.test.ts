import { afterEach, describe, expect, it, vi } from "vitest";
import { sendQuoteMemo } from "./memo";

const params = {
  accessToken: "access-token",
  linkUrl: "https://imdealer.example/quote/delivery/delivery-1",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("sendQuoteMemo", () => {
  it("accepts a Kakao response only when result_code is zero", async () => {
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () => Response.json({ result_code: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendQuoteMemo(params);

    expect(result).toEqual({ ok: true, reason: null });
    const request = fetchMock.mock.calls[0];
    const body = request?.[1]?.body;
    expect(body).toBeInstanceOf(URLSearchParams);
    if (!(body instanceof URLSearchParams)) {
      throw new TypeError("Expected URLSearchParams request body");
    }
    expect(body.get("request_url")).toBe(params.linkUrl);
    expect(request?.[0]).toBe(
      "https://kapi.kakao.com/v2/api/talk/memo/scrap/send"
    );
  });

  it("does not report success for a semantic Kakao API failure returned with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ result_code: -402, msg: "insufficient scopes" })
      )
    );

    const result = await sendQuoteMemo(params);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("result_code=-402");
    expect(result.reason).toContain("insufficient scopes");
  });
});
