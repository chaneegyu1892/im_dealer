import { describe, expect, it } from "vitest";
import {
  QUOTE_DELIVERED_DRAFT,
  REVIEW_REQUEST_DRAFT,
  buildQuoteDeliveredButtons,
  buildQuoteDeliveredMessage,
  buildReviewRequestButtons,
  buildReviewRequestMessage,
} from "./templates";

const VARS = {
  고객명: "홍길동",
  차량명: "쏘렌토",
  트림명: "프레스티지",
  상품유형: "리스",
  계약기간: 36,
  약정거리: 20000,
  월납입금: 763500,
  금융사: "오릭스캐피탈",
  링크: "https://www.imdealer.co.kr/quote/delivery/abc",
};

describe("buildQuoteDeliveredMessage", () => {
  // 승인 템플릿과 본문이 글자 단위로 다르면 resultCode 3016 으로 실패하고 재시도해도 소용없다.
  // 등록 원문에서 변수만 값으로 바꾼 결과와 완전히 같아야 한다.
  it("등록 원문의 변수만 치환한 결과와 일치한다", () => {
    const expected = QUOTE_DELIVERED_DRAFT.replace("#{고객명}", "홍길동")
      .replace("#{차량명}", "쏘렌토")
      .replace("#{트림명}", "프레스티지")
      .replace("#{상품유형}", "리스")
      .replace("#{계약기간}", "36")
      .replace("#{약정거리}", "20,000")
      .replace("#{월납입금}", "763,500")
      .replace("#{금융사}", "오릭스캐피탈");

    expect(buildQuoteDeliveredMessage(VARS)).toBe(expected);
  });

  it("미치환 변수가 남지 않는다", () => {
    expect(buildQuoteDeliveredMessage(VARS)).not.toMatch(/#\{/);
  });

  it("본문이 1300자를 넘지 않는다", () => {
    expect(buildQuoteDeliveredMessage(VARS).length).toBeLessThanOrEqual(1300);
  });
});

describe("buildQuoteDeliveredButtons", () => {
  // 버튼 링크에 미치환 변수가 남으면 링크 검증에 걸려 1030 으로 실패한다.
  it("모바일·PC 링크가 완성된 https URL 이다", () => {
    const [button] = buildQuoteDeliveredButtons(VARS.링크);
    expect(button.type).toBe("WL");
    expect(button.url_mobile).toBe(VARS.링크);
    expect(button.url_pc).toBe(VARS.링크);
    expect(button.url_mobile.startsWith("https://")).toBe(true);
  });
});

const REVIEW_VARS = {
  고객명: "홍길동",
  링크: "https://www.imdealer.co.kr/reviews/write/token-1",
} as const;

describe("buildReviewRequestMessage", () => {
  it("등록 원문의 변수만 치환한 결과와 일치한다", () => {
    const expected = REVIEW_REQUEST_DRAFT.replace("#{고객명}", "홍길동");
    expect(buildReviewRequestMessage(REVIEW_VARS)).toBe(expected);
  });

  it("미치환 변수가 남지 않는다", () => {
    expect(buildReviewRequestMessage(REVIEW_VARS)).not.toMatch(/#\{/);
  });

  it("본문이 1300자를 넘지 않는다", () => {
    expect(buildReviewRequestMessage(REVIEW_VARS).length).toBeLessThanOrEqual(1300);
  });
});

describe("buildReviewRequestButtons", () => {
  it("모바일·PC 링크가 완성된 https URL 이다", () => {
    const [button] = buildReviewRequestButtons(REVIEW_VARS.링크);
    expect(button?.type).toBe("WL");
    expect(button?.name).toBe("후기 작성하기");
    expect(button?.url_mobile).toBe(REVIEW_VARS.링크);
    expect(button?.url_pc).toBe(REVIEW_VARS.링크);
    expect(button?.url_mobile.startsWith("https://")).toBe(true);
  });
});
