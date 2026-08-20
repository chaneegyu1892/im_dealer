import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  googleAdsConversionId,
  googleAdsQuoteRequestSendTo,
  isGoogleAdsEnabled,
  trackQuoteRequestConversion,
} from "./google-ads";

const CONVERSION_ID = "AW-18396038759";
const QUOTE_REQUEST_LABEL = "rWy3CKr3i-QcEOeM9cNE";

function enableGoogleAds() {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", CONVERSION_ID);
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_QUOTE_REQUEST_LABEL", QUOTE_REQUEST_LABEL);
}

function installGtagSpy() {
  const gtag = vi.fn();
  window.gtag = gtag;
  return gtag;
}

beforeEach(() => {
  window.localStorage.clear();
  delete window.gtag;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("설정 읽기", () => {
  it("환경변수가 없으면 비활성이다", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", "");
    expect(isGoogleAdsEnabled()).toBe(false);
    expect(googleAdsQuoteRequestSendTo()).toBeNull();
  });

  it("전환 ID 와 라벨을 'ID/라벨' 형태로 합친다", () => {
    enableGoogleAds();
    expect(isGoogleAdsEnabled()).toBe(true);
    expect(googleAdsQuoteRequestSendTo()).toBe(
      `${CONVERSION_ID}/${QUOTE_REQUEST_LABEL}`
    );
  });

  it("라벨만 비면 전체 사이트 태그는 살리되 전환은 막는다", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", CONVERSION_ID);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_QUOTE_REQUEST_LABEL", "");
    expect(isGoogleAdsEnabled()).toBe(true);
    expect(googleAdsQuoteRequestSendTo()).toBeNull();
  });

  it("형식이 어긋난 전환 ID 는 인라인 스크립트 주입을 막기 위해 버린다", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID",
      "AW-1';alert(1);//"
    );
    expect(googleAdsConversionId()).toBe("");
    expect(isGoogleAdsEnabled()).toBe(false);
  });

  it("형식이 어긋난 라벨도 버린다", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", CONVERSION_ID);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_QUOTE_REQUEST_LABEL", "abc/../evil");
    expect(googleAdsQuoteRequestSendTo()).toBeNull();
  });
});

describe("견적 요청 전환 발사", () => {
  it("전환 설정이 없으면 gtag 가 있어도 발사하지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID", "");
    const gtag = installGtagSpy();
    expect(trackQuoteRequestConversion({ quoteId: "quote-1" })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("gtag 가 아직 로드되지 않았으면 조용히 실패한다", () => {
    enableGoogleAds();
    expect(trackQuoteRequestConversion({ quoteId: "quote-1" })).toBe(false);
  });

  it("send_to 와 transaction_id 를 담아 전환 이벤트를 보낸다", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();

    expect(trackQuoteRequestConversion({ quoteId: "quote-1" })).toBe(true);
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: `${CONVERSION_ID}/${QUOTE_REQUEST_LABEL}`,
      transaction_id: "quote-1",
    });
  });

  it("전환 가치가 주어지면 원화로 함께 보낸다", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();

    trackQuoteRequestConversion({ quoteId: "quote-1", value: 690000 });
    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: `${CONVERSION_ID}/${QUOTE_REQUEST_LABEL}`,
      transaction_id: "quote-1",
      value: 690000,
      currency: "KRW",
    });
  });

  it("0 이하·비유한 가치는 건수만 집계하도록 무시한다", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();

    trackQuoteRequestConversion({ quoteId: "quote-1", value: 0 });
    trackQuoteRequestConversion({ quoteId: "quote-2", value: Number.NaN });

    for (const call of gtag.mock.calls) {
      expect(call[2]).not.toHaveProperty("value");
    }
  });

  it("같은 견적은 두 번 집계하지 않는다 (뒤로가기·재제출 방어)", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();

    expect(trackQuoteRequestConversion({ quoteId: "quote-1" })).toBe(true);
    expect(trackQuoteRequestConversion({ quoteId: "quote-1" })).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it("다른 견적은 각각 집계한다", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();

    trackQuoteRequestConversion({ quoteId: "quote-1" });
    trackQuoteRequestConversion({ quoteId: "quote-2" });
    expect(gtag).toHaveBeenCalledTimes(2);
  });

  it("견적 ID 가 비면 발사하지 않는다", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();

    expect(trackQuoteRequestConversion({ quoteId: "" })).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("localStorage 를 못 써도 전환은 계속 발사한다", () => {
    enableGoogleAds();
    const gtag = installGtagSpy();
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("사파리 프라이빗 모드");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("사파리 프라이빗 모드");
      });

    expect(trackQuoteRequestConversion({ quoteId: "quote-1" })).toBe(true);
    expect(gtag).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("중복 방지 목록이 무한히 커지지 않는다", () => {
    enableGoogleAds();
    installGtagSpy();

    for (let i = 0; i < 60; i += 1) {
      trackQuoteRequestConversion({ quoteId: `quote-${i}` });
    }

    const stored: unknown = JSON.parse(
      window.localStorage.getItem("imdealer:google-ads:reported-quotes") ?? "[]"
    );
    expect(Array.isArray(stored) && stored.length).toBeLessThanOrEqual(50);
  });
});
