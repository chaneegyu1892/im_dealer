import { describe, expect, it } from "vitest";
import {
  parsePhone,
  formatPhone,
  validateBizNumber,
  formatBizNumber,
  phoneSchema,
  bizNumberSchema,
} from "./korean";

describe("parsePhone", () => {
  it("accepts standard hyphenated format", () => {
    expect(parsePhone("010-1234-5678")).toEqual({ ok: true, normalized: "010-1234-5678" });
  });

  it("accepts no-hyphen format", () => {
    expect(parsePhone("01012345678")).toEqual({ ok: true, normalized: "010-1234-5678" });
  });

  it("accepts spaced format", () => {
    expect(parsePhone("010 1234 5678")).toEqual({ ok: true, normalized: "010-1234-5678" });
  });

  it("accepts +82 prefix variants", () => {
    expect(parsePhone("+82 10 1234 5678")).toEqual({ ok: true, normalized: "010-1234-5678" });
    expect(parsePhone("+821012345678")).toEqual({ ok: true, normalized: "010-1234-5678" });
    expect(parsePhone("82-10-1234-5678")).toEqual({ ok: true, normalized: "010-1234-5678" });
  });

  it("rejects empty input", () => {
    expect(parsePhone("").ok).toBe(false);
    expect(parsePhone("   ").ok).toBe(false);
  });

  it("rejects wrong digit count", () => {
    expect(parsePhone("010-1234-567").ok).toBe(false);
    expect(parsePhone("010-12345-6789").ok).toBe(false);
  });

  it("rejects non-010 prefix", () => {
    expect(parsePhone("020-1234-5678").ok).toBe(false);
    expect(parsePhone("011-1234-5678").ok).toBe(false); // 11x 는 보수적으로 거부
  });

  it("rejects non-numeric garbage", () => {
    expect(parsePhone("phone").ok).toBe(false);
    expect(parsePhone("010-가나다-5678").ok).toBe(false);
  });
});

describe("formatPhone", () => {
  it("normalizes valid input", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
  });

  it("returns original for invalid input (non-destructive)", () => {
    expect(formatPhone("invalid")).toBe("invalid");
  });

  it("is idempotent on already-formatted input", () => {
    expect(formatPhone("010-1234-5678")).toBe("010-1234-5678");
  });
});

describe("validateBizNumber", () => {
  // 아래 번호들은 공식 알고리즘(가중치 [1,3,7,1,3,7,1,3,5]+9번째자리 보정)
  // 으로 체크섬이 일치하는 합법적 형식의 번호. 실제 등록 여부와 무관하게
  // "체크섬을 통과하는 형식"의 검증 케이스로 사용.
  it("accepts checksum-valid numbers", () => {
    expect(validateBizNumber("123-45-67891")).toBe(true);
    expect(validateBizNumber("105-87-66536")).toBe(true);
    expect(validateBizNumber("1234567891")).toBe(true); // 하이픈 없이
  });

  it("rejects checksum mismatch", () => {
    expect(validateBizNumber("123-45-67890")).toBe(false); // 마지막 자리 1 빗나감
    expect(validateBizNumber("105-87-66533")).toBe(false); // 마지막 자리 3 빗나감
  });

  it("rejects wrong length", () => {
    expect(validateBizNumber("123-45-6789")).toBe(false); // 9자리
    expect(validateBizNumber("12345678901")).toBe(false); // 11자리
    expect(validateBizNumber("")).toBe(false);
  });

  it("rejects all-zeros", () => {
    expect(validateBizNumber("000-00-00000")).toBe(false);
    expect(validateBizNumber("0000000000")).toBe(false);
  });

  it("ignores formatting characters", () => {
    expect(validateBizNumber("123 45 67891")).toBe(true);
    expect(validateBizNumber(" 123-45-67891 ")).toBe(true);
  });
});

describe("formatBizNumber", () => {
  it("formats 10-digit input", () => {
    expect(formatBizNumber("1234567891")).toBe("123-45-67891");
  });

  it("is idempotent on already-formatted", () => {
    expect(formatBizNumber("123-45-67891")).toBe("123-45-67891");
  });

  it("returns original for non-10-digit", () => {
    expect(formatBizNumber("invalid")).toBe("invalid");
  });
});

describe("Zod schemas", () => {
  it("phoneSchema parses and normalizes", () => {
    expect(phoneSchema.parse("01012345678")).toBe("010-1234-5678");
  });

  it("phoneSchema rejects invalid", () => {
    expect(() => phoneSchema.parse("020-1234-5678")).toThrow();
  });

  it("bizNumberSchema accepts and formats", () => {
    expect(bizNumberSchema.parse("1234567891")).toBe("123-45-67891");
  });

  it("bizNumberSchema rejects invalid checksum", () => {
    expect(() => bizNumberSchema.parse("123-45-67890")).toThrow();
  });
});
