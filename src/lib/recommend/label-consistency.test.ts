import { describe, it, expect } from "vitest";
import { PURPOSE_OPTIONS, INDUSTRY_OPTIONS } from "@/constants/recommend-options";
import { SCORING_PURPOSES, SCORING_INDUSTRIES, INDUSTRY_RULES, PURPOSE_RULES } from "@/lib/recommend/scoring-rules";

describe("스코어링 라벨이 실제 선택지와 일치", () => {
  it("스코어링 목적은 모두 실제 선택지에 존재", () => {
    const valid = new Set<string>(PURPOSE_OPTIONS.map((o) => o.value));
    for (const p of SCORING_PURPOSES) {
      expect(valid.has(p)).toBe(true);
    }
  });

  it("스코어링 업종은 모두 실제 선택지에 존재", () => {
    const valid = new Set<string>(INDUSTRY_OPTIONS.map((o) => o.value));
    for (const i of SCORING_INDUSTRIES) {
      expect(valid.has(i)).toBe(true);
    }
  });

  it("모든 업종 선택지는 스코어링 규칙을 가진다", () => {
    for (const o of INDUSTRY_OPTIONS) expect(Object.keys(INDUSTRY_RULES)).toContain(o.value);
  });

  it("모든 목적 선택지는 스코어링 규칙 키를 가진다", () => {
    for (const o of PURPOSE_OPTIONS) expect(Object.keys(PURPOSE_RULES)).toContain(o.value);
  });
});
