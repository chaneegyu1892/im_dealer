import { describe, it, expect } from "vitest";
import { brandOrigin, shipmentModeFor, DEFAULT_LEASE_TYPE } from "./standard-conditions";

describe("standard-conditions", () => {
  it("국산 브랜드는 domestic (표기 이형 포함)", () => {
    for (const b of ["현대", "기아", "제네시스", "쉐보레", "KGM", "쌍용", "르노코리아", "대창모터스"]) {
      expect(brandOrigin(b)).toBe("domestic");
    }
  });

  it("수입 브랜드는 imported", () => {
    for (const b of ["벤츠", "BMW", "테슬라", "BYD", "폭스바겐"]) {
      expect(brandOrigin(b)).toBe("imported");
    }
  });

  it("미등록 브랜드는 null — 호출측이 명시적으로 결정", () => {
    expect(brandOrigin("페라리")).toBeNull();
    expect(brandOrigin("")).toBeNull();
  });

  it("회의 결정 규칙: 국산=특판, 수입=비제휴", () => {
    expect(shipmentModeFor("domestic")).toBe("특판");
    expect(shipmentModeFor("imported")).toBe("비제휴");
  });

  it("리스 기본 종류는 운용리스", () => {
    expect(DEFAULT_LEASE_TYPE).toBe("운용리스");
  });
});
