import { afterEach, describe, expect, it, vi } from "vitest";
import { REFERRAL_CODE_REGEX, buildReferralLink, generateReferralCode } from "./code";

const SAMPLE_SIZE = 2000;

function sample(size = SAMPLE_SIZE): string[] {
  return Array.from({ length: size }, () => generateReferralCode());
}

describe("generateReferralCode", () => {
  it("항상 알파벳 1자 + 숫자 4자 형식이다", () => {
    for (const code of sample()) {
      expect(code).toMatch(REFERRAL_CODE_REGEX);
      expect(code).toHaveLength(5);
    }
  });

  it("오독되는 I, O 는 첫 글자로 쓰지 않는다", () => {
    const letters = new Set(sample().map((code) => code[0]));
    expect(letters.has("I")).toBe(false);
    expect(letters.has("O")).toBe(false);
    // 24자 알파벳에서 2000회 뽑으면 사실상 전부 등장한다(임계는 넉넉히 잡음).
    expect(letters.size).toBeGreaterThanOrEqual(12);
  });

  it("호출마다 다른 값을 만든다", () => {
    const codes = sample(500);
    // 240,000 조합에서 500회 → 충돌 기대값 0.5 미만. 임계 450 은 사실상 실패 불가.
    expect(new Set(codes).size).toBeGreaterThanOrEqual(450);
    expect(new Set(codes.map((code) => code.slice(1))).size).toBeGreaterThan(1);
  });
});

describe("buildReferralLink", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("앱 URL 뒤에 /r/<code> 를 붙인다", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example");
    expect(buildReferralLink("A1234")).toBe("https://imdealer.example/r/A1234");
  });

  it("끝 슬래시가 있어도 // 로 겹치지 않는다", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://imdealer.example/");
    expect(buildReferralLink("A1234")).toBe("https://imdealer.example/r/A1234");
  });

  it("환경변수가 없으면 상대 경로로 떨어진다", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(buildReferralLink("A1234")).toBe("/r/A1234");
  });
});
