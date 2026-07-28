import { describe, expect, it } from "vitest";
import {
  STEP02_V3_CATALOG_NAMES,
  STEP02_V3_CHILD_BONUS,
  STEP02_V3_CARGO_BONUS,
  STEP02_V3_POINTS,
  STEP02_V3_STYLE_PLACEMENTS,
  getStep02V3FollowupBonus,
  getStep02V3StyleLevel,
} from "./step02-v3-data";

describe("STEP 02 v3 PDF mapping", () => {
  it("keeps every PDF tier count and 86 unique vehicle names", () => {
    expect(Object.fromEntries(
      Object.entries(STEP02_V3_STYLE_PLACEMENTS).map(([style, placement]) => [
        style,
        placement.best.length + placement.fit.length + placement.support.length,
      ])
    )).toEqual({
      "family-leisure": 48,
      "city-compact": 23,
      "sedan-comfort": 25,
      "low-running-cost": 38,
      "premium-formal": 21,
    });
    expect(STEP02_V3_CATALOG_NAMES.size).toBe(86);
  });

  it("does not place one vehicle in multiple tiers of the same style", () => {
    for (const placement of Object.values(STEP02_V3_STYLE_PLACEMENTS)) {
      const names = [...placement.best, ...placement.fit, ...placement.support];
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("implements both PDF score examples without rounding or hidden weights", () => {
    const family = "family-leisure" as const;
    const score = (name: string, detail: "미취학" | "대형 화물", situation: "가족" | "화물") =>
      STEP02_V3_POINTS[getStep02V3StyleLevel(family, name)]
      + getStep02V3FollowupBonus({
        situationPreference: situation,
        ...(situation === "가족" ? { childDetail: detail } : { cargoDetail: detail }),
      }, name);

    expect(score("디 올 뉴 싼타페 HEV", "미취학", "가족")).toBe(8);
    expect(score("더 뉴 쏘렌토 HEV", "미취학", "가족")).toBe(8);
    expect(score("디 올 뉴 팰리세이드", "미취학", "가족")).toBe(5);
    expect(score("GV70", "미취학", "가족")).toBe(4);
    expect(score("더 뉴 카니발 HEV", "대형 화물", "화물")).toBe(8);
    expect(score("더 뉴 스타리아 HEV", "대형 화물", "화물")).toBe(8);
    expect(score("디 올 뉴 팰리세이드 HEV", "대형 화물", "화물")).toBe(5);
  });

  it("keeps follow-up bonuses uniform at exactly 3 points", () => {
    for (const [detail, names] of Object.entries(STEP02_V3_CHILD_BONUS)) {
      for (const name of names) {
        expect(getStep02V3FollowupBonus({ situationPreference: "가족", childDetail: detail }, name)).toBe(3);
      }
    }
    for (const [detail, names] of Object.entries(STEP02_V3_CARGO_BONUS)) {
      for (const name of names) {
        expect(getStep02V3FollowupBonus({ situationPreference: "화물", cargoDetail: detail }, name)).toBe(3);
      }
    }
  });

  it("gives every ICE, HEV, and EV sibling the strongest tier in its model family", () => {
    expect([
      "더 뉴 아반떼",
      "더 뉴 아반떼 HEV",
    ].map((name) => getStep02V3StyleLevel("low-running-cost", name)))
      .toEqual(["best", "best"]);
    expect([
      "디 올 뉴 코나",
      "디 올 뉴 코나 HEV",
      "디 올 뉴 코나 EV",
    ].map((name) => getStep02V3StyleLevel("low-running-cost", name)))
      .toEqual(["best", "best", "best"]);
    expect([
      "뉴 토레스",
      "뉴 토레스 HEV",
      "토레스 EVX",
    ].map((name) => getStep02V3StyleLevel("low-running-cost", name)))
      .toEqual(["fit", "fit", "fit"]);
    expect([
      "GV70",
      "Electrified GV70 F/L",
    ].map((name) => getStep02V3StyleLevel("family-leisure", name)))
      .toEqual(["support", "support"]);
  });
});
