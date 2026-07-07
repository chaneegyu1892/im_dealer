import { describe, it, expect } from "vitest";
import { toE164KR } from "./phone";

describe("toE164KR", () => {
  it("하이픈 포함 번호를 변환한다", () => {
    expect(toE164KR("010-1234-5678")).toBe("+821012345678");
  });

  it("하이픈 없는 번호를 변환한다", () => {
    expect(toE164KR("01012345678")).toBe("+821012345678");
  });

  it("이미 +82 가 붙은 번호를 정규화한다", () => {
    expect(toE164KR("+82 10-1234-5678")).toBe("+821012345678");
    expect(toE164KR("821012345678")).toBe("+821012345678");
  });

  it("null/빈값/공백은 undefined", () => {
    expect(toE164KR(null)).toBeUndefined();
    expect(toE164KR(undefined)).toBeUndefined();
    expect(toE164KR("")).toBeUndefined();
    expect(toE164KR("---")).toBeUndefined();
  });

  it("유효하지 않은 번호는 undefined", () => {
    expect(toE164KR("010-0000-0000")).toBe("+821000000000"); // 형식상 유효
    expect(toE164KR("1234")).toBeUndefined(); // 너무 짧음
    expect(toE164KR("021234567")).toBeUndefined(); // 휴대폰 아님(0 제거 후 2로 시작)
  });
});
