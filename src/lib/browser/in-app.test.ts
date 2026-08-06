import { describe, expect, it } from "vitest";
import { buildEscapeUrl, isKakaoTalkInApp } from "./in-app";

const KAKAO_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.5.0";
const KAKAO_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.5.0";
const SAFARI_IOS_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const KAKAO_DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 KAKAOTALK";

describe("isKakaoTalkInApp", () => {
  it("detects the KakaoTalk in-app browser on iOS", () => {
    expect(isKakaoTalkInApp(KAKAO_IOS_UA)).toBe(true);
  });

  it("detects the KakaoTalk in-app browser on Android", () => {
    expect(isKakaoTalkInApp(KAKAO_ANDROID_UA)).toBe(true);
  });

  it("does not flag ordinary mobile browsers", () => {
    expect(isKakaoTalkInApp(SAFARI_IOS_UA)).toBe(false);
    expect(isKakaoTalkInApp(CHROME_ANDROID_UA)).toBe(false);
  });

  it("returns false for an empty user agent", () => {
    expect(isKakaoTalkInApp("")).toBe(false);
  });
});

describe("buildEscapeUrl", () => {
  it("builds the openExternal scheme on iOS", () => {
    const result = buildEscapeUrl(
      "https://imdealer.example/login?next=%2Fmypage",
      KAKAO_IOS_UA
    );

    expect(result).toBe(
      "kakaotalk://web/openExternal?url=" +
        encodeURIComponent("https://imdealer.example/login?next=%2Fmypage")
    );
  });

  it("builds an intent URL with a fallback on Android", () => {
    const result = buildEscapeUrl(
      "https://imdealer.example/login?next=%2Fmypage",
      KAKAO_ANDROID_UA
    );

    expect(result).toBe(
      "intent://imdealer.example/login?next=%2Fmypage" +
        "#Intent;scheme=https" +
        ";S.browser_fallback_url=" +
        encodeURIComponent("https://imdealer.example/login?next=%2Fmypage") +
        ";end"
    );
    // package 를 지정하지 않아야 크롬이 없는 기기에서도 브라우저 선택 창이 뜬다.
    expect(result).not.toContain("package=");
  });

  it("keeps the hash out of the intent path but inside the fallback URL", () => {
    const result = buildEscapeUrl(
      "https://imdealer.example/login#section",
      KAKAO_ANDROID_UA
    );

    expect(result).not.toContain("intent://imdealer.example/login#section");
    expect(result).toContain(
      "S.browser_fallback_url=" +
        encodeURIComponent("https://imdealer.example/login#section")
    );
  });

  it("derives the intent scheme from the target URL", () => {
    const result = buildEscapeUrl("http://localhost:3000/login", KAKAO_ANDROID_UA);

    expect(result).toContain("scheme=http;");
    expect(result).toContain("intent://localhost:3000/login");
  });

  it("returns null outside the KakaoTalk in-app browser", () => {
    expect(buildEscapeUrl("https://imdealer.example/login", SAFARI_IOS_UA)).toBeNull();
    expect(
      buildEscapeUrl("https://imdealer.example/login", CHROME_ANDROID_UA)
    ).toBeNull();
  });

  it("returns null when the platform has no escape scheme", () => {
    expect(
      buildEscapeUrl("https://imdealer.example/login", KAKAO_DESKTOP_UA)
    ).toBeNull();
  });

  it("rejects non-http protocols", () => {
    expect(buildEscapeUrl("javascript:alert(1)", KAKAO_IOS_UA)).toBeNull();
    expect(buildEscapeUrl("data:text/html,<p>x</p>", KAKAO_ANDROID_UA)).toBeNull();
  });

  it("returns null for an unparseable target URL", () => {
    expect(buildEscapeUrl("not a url", KAKAO_IOS_UA)).toBeNull();
    expect(buildEscapeUrl("", KAKAO_IOS_UA)).toBeNull();
  });
});
