import { describe, it, expect } from "vitest";
import { parseKakaoAccount, parseAgreedTermTags } from "./account";

describe("parseKakaoAccount", () => {
  it("동의한 항목을 모두 뽑아낸다", () => {
    const json = {
      id: 1234567890,
      kakao_account: {
        phone_number: "+82 10-1234-5678",
        name: "홍길동",
        email: "hong@example.com",
      },
    };
    expect(parseKakaoAccount(json)).toEqual({
      kakaoId: "1234567890",
      phone: "+82 10-1234-5678",
      name: "홍길동",
      email: "hong@example.com",
    });
  });

  it("미동의 항목은 null 이다", () => {
    const json = { id: 1, kakao_account: { phone_number: "+82 10-1234-5678" } };
    const parsed = parseKakaoAccount(json);
    expect(parsed.phone).toBe("+82 10-1234-5678");
    expect(parsed.name).toBeNull();
    expect(parsed.email).toBeNull();
  });

  it("빈 문자열은 null 로 정규화한다", () => {
    const json = { id: 1, kakao_account: { email: "   " } };
    expect(parseKakaoAccount(json).email).toBeNull();
  });

  it("kakao_account 가 없어도 터지지 않는다", () => {
    expect(parseKakaoAccount({ id: 42 })).toEqual({
      kakaoId: "42",
      phone: null,
      name: null,
      email: null,
    });
  });

  it("빈 응답이면 전부 null 이다", () => {
    expect(parseKakaoAccount({})).toEqual({
      kakaoId: null,
      phone: null,
      name: null,
      email: null,
    });
  });
});

describe("parseAgreedTermTags", () => {
  it("동의한 약관 tag 만 반환한다", () => {
    const json = {
      service_terms: [
        { tag: "marketing", agreed: true },
        { tag: "optional-analytics", agreed: false },
        { tag: "tos", agreed: true },
      ],
    };
    expect(parseAgreedTermTags(json)).toEqual(["marketing", "tos"]);
  });

  it("service_terms 가 없으면 빈 배열이다", () => {
    expect(parseAgreedTermTags({})).toEqual([]);
    expect(parseAgreedTermTags(null)).toEqual([]);
  });

  it("tag 가 없는 항목은 건너뛴다", () => {
    const json = { service_terms: [{ agreed: true }, { tag: "marketing", agreed: true }] };
    expect(parseAgreedTermTags(json)).toEqual(["marketing"]);
  });
});
