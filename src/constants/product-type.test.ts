import { describe, it, expect } from "vitest";

import { PRODUCT_TYPE_VALUES, productTypeLabel } from "./product-type";

describe("productTypeLabel", () => {
  it('저장값 "리스"는 "운용리스"로 표기한다', () => {
    expect(productTypeLabel("리스")).toBe("운용리스");
  });

  it('저장값 "장기렌트"는 그대로 표기한다', () => {
    expect(productTypeLabel("장기렌트")).toBe("장기렌트");
  });

  it('저장값 "금융리스"/"할부"는 그대로 표기한다', () => {
    expect(productTypeLabel("금융리스")).toBe("금융리스");
    expect(productTypeLabel("할부")).toBe("할부");
  });

  it("알 수 없는 값은 원본을 그대로 돌려준다", () => {
    expect(productTypeLabel("일시불")).toBe("일시불");
  });

  it("빈 값은 빈 문자열", () => {
    expect(productTypeLabel(null)).toBe("");
    expect(productTypeLabel(undefined)).toBe("");
    expect(productTypeLabel("")).toBe("");
  });
});

describe("PRODUCT_TYPE_VALUES", () => {
  it("저장값은 DB 호환을 위해 기존 값을 유지하고 뒤에만 추가한다", () => {
    expect(PRODUCT_TYPE_VALUES).toEqual(["장기렌트", "리스", "금융리스", "할부"]);
  });
});
