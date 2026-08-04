import { describe, expect, it } from "vitest";
import { formatKRWMan, formatKRWManWon } from "./format";

describe("formatKRWMan", () => {
  it("만원 단위로 반올림한다", () => {
    expect(formatKRWMan(624_000)).toBe("62만원");
    expect(formatKRWMan(1_250_118)).toBe("125만원");
  });
});

// 근접 후보 안내는 "2.4만원 차이"처럼 아까움이 드러나야 한다.
// 만원 단위로 반올림하면 2만원과 2.4만원이 같은 말이 되어 버린다.
describe("formatKRWManWon", () => {
  it("만원과 원을 함께 드러낸다", () => {
    expect(formatKRWManWon(124_000)).toBe("12만 4,000원");
    expect(formatKRWManWon(24_000)).toBe("2만 4,000원");
  });

  it("나머지가 없으면 만원만 쓴다", () => {
    expect(formatKRWManWon(100_000)).toBe("10만원");
    expect(formatKRWManWon(2_000_000)).toBe("200만원");
  });

  it("만원 미만은 원으로만 쓴다", () => {
    expect(formatKRWManWon(5_000)).toBe("5,000원");
    expect(formatKRWManWon(0)).toBe("0원");
  });
});
