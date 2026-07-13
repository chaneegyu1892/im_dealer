import { describe, expect, it } from "vitest";
import { readLegacyScoreMatrixBonus } from "./recommend-legacy-score-matrix";

describe("readLegacyScoreMatrixBonus", () => {
  it("returns a positive configured industry and purpose bonus", () => {
    expect(readLegacyScoreMatrixBonus({ 개인: { 가족: 3 } }, "개인", "가족")).toBe(3);
  });

  it.each([null, [], "invalid", { 개인: { 가족: -1 } }, { 개인: { 가족: "3" } }])(
    "returns zero for malformed or non-positive matrix value %#",
    (value) => {
      expect(readLegacyScoreMatrixBonus(value, "개인", "가족")).toBe(0);
    },
  );
});
