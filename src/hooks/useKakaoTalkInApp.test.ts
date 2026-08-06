import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useKakaoTalkInApp } from "./useKakaoTalkInApp";

const ORIGINAL_UA = window.navigator.userAgent;

const KAKAO_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.5.0";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

afterEach(() => {
  setUserAgent(ORIGINAL_UA);
});

describe("useKakaoTalkInApp", () => {
  it("reports the KakaoTalk in-app browser with an escape URL", async () => {
    setUserAgent(KAKAO_ANDROID_UA);

    const { result } = renderHook(() => useKakaoTalkInApp());

    await waitFor(() => expect(result.current.isInApp).toBe(true));
    expect(result.current.escapeUrl).toContain("intent://");
  });

  it("stays inactive in an ordinary browser", async () => {
    const { result } = renderHook(() => useKakaoTalkInApp());

    await waitFor(() => expect(result.current.isInApp).toBe(false));
    expect(result.current.escapeUrl).toBeNull();
  });
});
