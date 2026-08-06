import { describe, expect, it } from "vitest";
import { generateCouponCode } from "./code";

describe("generateCouponCode", () => {
  it("AD- 접두어와 6자리 코드를 만든다", () => {
    expect(generateCouponCode()).toMatch(/^AD-[A-Z2-9]{6}$/);
  });

  it("혼동하기 쉬운 문자(I, O, 0, 1)를 쓰지 않는다", () => {
    const codes = Array.from({ length: 200 }, () => generateCouponCode());
    for (const code of codes) {
      expect(code.slice(3)).not.toMatch(/[IO01]/);
    }
  });

  it("연속 호출에서 중복이 사실상 나오지 않는다", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateCouponCode()));
    expect(codes.size).toBe(500);
  });
});
