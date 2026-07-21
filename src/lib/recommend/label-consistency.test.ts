import { describe, it, expect } from "vitest";
import {
  INDUSTRY_OPTIONS,
  CHARGING_OPTIONS,
  MILEAGE_OPTIONS,
  PREFERENCE_OPTIONS,
  PREFERENCE_DETAIL_OPTIONS,
  REGION_OPTIONS,
} from "@/constants/recommend-options";
import {
  ANNUAL_MILEAGE_PROFILE_KEYS,
  CARGO_DETAIL_PROFILE_KEYS,
  CHARGING_PROFILE_KEYS,
  CHILD_DETAIL_PROFILE_KEYS,
  INDUSTRY_PROFILE_KEYS,
  PRIMARY_PREFERENCE_PROFILE_KEYS,
  REGION_PROFILE_KEYS,
} from "@/lib/recommend/overlap-profile";
import {
  SCORING_INDUSTRIES,
  SCORING_PREFERENCES,
  INDUSTRY_RULES,
  PREFERENCE_RULES,
  CHILD_RULES,
} from "@/lib/recommend/scoring-rules";
import { STEP02_V3_STYLE_OPTIONS } from "@/constants/recommend-step02-v3";
import { STEP02_V3_STYLE_PLACEMENTS } from "@/lib/recommend/step02-v3-data";

describe("스코어링 라벨이 실제 선택지와 일치", () => {
  it("스코어링 업종은 모두 실제 선택지에 존재", () => {
    const valid = new Set<string>(INDUSTRY_OPTIONS.map((o) => o.value));
    for (const i of SCORING_INDUSTRIES) {
      expect(valid.has(i)).toBe(true);
    }
  });

  it("모든 업종 선택지는 스코어링 규칙을 가진다", () => {
    for (const o of INDUSTRY_OPTIONS) {
      expect(Object.keys(INDUSTRY_RULES)).toContain(o.value);
    }
  });

  it("PREFERENCE_OPTIONS ↔ SCORING_PREFERENCES 양방향 일치", () => {
    const optionValues = new Set<string>(PREFERENCE_OPTIONS.map((o) => o.value));
    const scoringValues = new Set<string>(SCORING_PREFERENCES);
    for (const v of SCORING_PREFERENCES) expect(optionValues.has(v)).toBe(true);
    for (const o of PREFERENCE_OPTIONS) expect(scoringValues.has(o.value)).toBe(true);
  });

  it("느낌형 선택지는 모두 PREFERENCE_RULES 규칙을 가진다", () => {
    const feels = PREFERENCE_OPTIONS.filter((o) => o.kind === "feel");
    for (const o of feels) {
      expect(Object.keys(PREFERENCE_RULES)).toContain(o.value);
    }
  });

  it("상황형 선택지는 모두 상세질문(PREFERENCE_DETAIL_OPTIONS)을 가진다", () => {
    const situations = PREFERENCE_OPTIONS.filter((o) => o.kind === "situation");
    for (const o of situations) {
      expect(Object.keys(PREFERENCE_DETAIL_OPTIONS)).toContain(o.value);
      expect((PREFERENCE_DETAIL_OPTIONS[o.value] ?? []).length).toBeGreaterThan(0);
    }
  });

  it("가족 상세값은 모두 CHILD_RULES 키와 일치", () => {
    for (const opt of PREFERENCE_DETAIL_OPTIONS["가족"] ?? []) {
      expect(Object.keys(CHILD_RULES)).toContain(opt.value);
    }
  });

  it("화물 상세값은 CARGO_RULES가 인식하는 값(소형 박스/대형 화물)이어야 한다", () => {
    const known = new Set(["소형 박스", "대형 화물"]);
    for (const opt of PREFERENCE_DETAIL_OPTIONS["화물"] ?? []) {
      expect(known.has(opt.value)).toBe(true);
    }
  });

  it("overlap-v2 프로필 키는 현재 공개 선택지와 양방향 일치", () => {
    expect([...INDUSTRY_PROFILE_KEYS].sort()).toEqual(
      INDUSTRY_OPTIONS.map((option) => option.value).sort()
    );
    expect([...PRIMARY_PREFERENCE_PROFILE_KEYS].sort()).toEqual(
      PREFERENCE_OPTIONS
        .filter((option) => option.kind === "feel")
        .map((option) => option.value)
        .sort()
    );
    expect([...CHILD_DETAIL_PROFILE_KEYS].sort()).toEqual(
      (PREFERENCE_DETAIL_OPTIONS["가족"] ?? []).map((option) => option.value).sort()
    );
    expect([...CARGO_DETAIL_PROFILE_KEYS].sort()).toEqual(
      (PREFERENCE_DETAIL_OPTIONS["화물"] ?? []).map((option) => option.value).sort()
    );
    expect([...ANNUAL_MILEAGE_PROFILE_KEYS].sort()).toEqual(
      MILEAGE_OPTIONS.map((option) => String(option.value)).sort()
    );
    expect([...REGION_PROFILE_KEYS].sort()).toEqual(
      REGION_OPTIONS.map((option) => option.value).sort()
    );
    expect([...CHARGING_PROFILE_KEYS].sort()).toEqual(
      CHARGING_OPTIONS.map((option) => option.value).sort()
    );
  });

  it("STEP 02 v3의 점수형 스타일은 PDF 배치표와 정확히 대응한다", () => {
    const scoredStyles = STEP02_V3_STYLE_OPTIONS
      .map((option) => option.value)
      .filter((value) => value !== "auto")
      .sort();
    expect(scoredStyles).toEqual(Object.keys(STEP02_V3_STYLE_PLACEMENTS).sort());
  });
});
