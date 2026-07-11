import { describe, expect, it } from "vitest";
import { overlapProfileSchema } from "./overlap-profile";
import { rankOverlapCandidates, type RankableOverlapCandidate } from "./overlap-ranking";

function profile(
  fuelGroup: "EV" | "HEV" | "ICE",
  companyPriority = 0,
  profitPriority = 0
) {
  const level = "none";
  return overlapProfileSchema.parse({
    version: "overlap-v2",
    fuelGroup,
    companyPriority,
    profitPriority,
    scores: {
      industry: { 법인: level, 개인사업자: level, 개인: level },
      primaryPreference: { 안정감: level, 주차편의: level, 경제성: level, 고급: level },
      additionalCondition: {
        family: {
          default: level,
          details: { 영유아: level, 미취학: level, 초등: level, "중학생+": level },
        },
        cargo: { default: level, details: { "소형 박스": level, "대형 화물": level } },
      },
      annualMileage: { "10000": level, "20000": level, "30000": level },
      region: { 일반: level, "강원·산간": level, 제주: level },
    },
    ...(fuelGroup === "EV"
      ? { chargingFit: { 자택: level, 직장: level, 외부: level, 없음: level } }
      : {}),
  });
}

function candidate(overrides: Partial<RankableOverlapCandidate> = {}): RankableOverlapCandidate {
  return {
    vehicleId: "vehicle-a",
    slug: "vehicle-a",
    modelKey: "brand:model-a",
    modelYear: 2026,
    isPopular: false,
    profile: profile("ICE"),
    score: {
      documentScore: 10,
      chargingAdjustment: 0,
      rankScore: 10,
      contributions: [],
    },
    ...overrides,
  };
}

describe("rankOverlapCandidates", () => {
  const fuelCases: Array<["전기차" | "하이브리드" | "가솔린/디젤", "EV" | "HEV" | "ICE"]> = [
    ["전기차", "EV"],
    ["하이브리드", "HEV"],
    ["가솔린/디젤", "ICE"],
  ];

  it.each(fuelCases)("hard filters %s to %s profiles", (fuelPreference, fuelGroup) => {
    const candidates = [
      candidate({ slug: "ev", vehicleId: "ev", modelKey: "ev", profile: profile("EV") }),
      candidate({ slug: "hev", vehicleId: "hev", modelKey: "hev", profile: profile("HEV") }),
      candidate({ slug: "ice", vehicleId: "ice", modelKey: "ice", profile: profile("ICE") }),
    ];
    const ranked = rankOverlapCandidates(candidates, fuelPreference);
    expect(ranked.map((item) => item.profile.fuelGroup)).toEqual([fuelGroup]);
  });

  it("does not fill 0, 1, or 2 candidates to three", () => {
    expect(rankOverlapCandidates([], "상관없음")).toHaveLength(0);
    expect(rankOverlapCandidates([candidate()], "상관없음")).toHaveLength(1);
    expect(
      rankOverlapCandidates(
        [candidate(), candidate({ vehicleId: "b", slug: "b", modelKey: "b" })],
        "상관없음"
      )
    ).toHaveLength(2);
  });

  it("deduplicates a model by latest year before score", () => {
    const oldHigh = candidate({ slug: "old", vehicleId: "old", modelYear: 2025 });
    const newLow = candidate({
      slug: "new",
      vehicleId: "new",
      modelYear: 2026,
      score: { ...oldHigh.score, documentScore: 1, rankScore: 1 },
    });
    expect(rankOverlapCandidates([oldHigh, newLow], "상관없음").map((item) => item.slug)).toEqual([
      "new",
    ]);
  });

  it("applies every comparator key in declared order", () => {
    const values = [
      candidate({ vehicleId: "f", slug: "f", modelKey: "f" }),
      candidate({
        vehicleId: "e",
        slug: "e",
        modelKey: "e",
        profile: profile("ICE", 0, 1),
      }),
      candidate({ vehicleId: "d", slug: "d", modelKey: "d", isPopular: true }),
      candidate({
        vehicleId: "c",
        slug: "c",
        modelKey: "c",
        profile: profile("ICE", 1, 0),
      }),
      candidate({ vehicleId: "b", slug: "b", modelKey: "b", modelYear: 2027 }),
      candidate({
        vehicleId: "a",
        slug: "a",
        modelKey: "a",
        score: { ...candidate().score, documentScore: 11, rankScore: 11 },
      }),
    ];
    expect(rankOverlapCandidates(values, "상관없음").map((item) => item.slug)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(
      rankOverlapCandidates(values.filter((item) => item.slug !== "a" && item.slug !== "b"), "상관없음")
        .map((item) => item.slug)
    ).toEqual(["c", "d", "e"]);
  });

  it("is stable across shuffled input", () => {
    const values = Array.from({ length: 8 }, (_, index) =>
      candidate({
        vehicleId: `vehicle-${index}`,
        slug: `vehicle-${index}`,
        modelKey: `model-${index}`,
      })
    );
    const expected = rankOverlapCandidates(values, "상관없음").map((item) => item.slug);
    for (let index = 0; index < 20; index += 1) {
      const shuffled = [...values].sort((left, right) =>
        (left.slug.charCodeAt(left.slug.length - 1) * (index + 3)) % 11
        - (right.slug.charCodeAt(right.slug.length - 1) * (index + 3)) % 11
      );
      expect(rankOverlapCandidates(shuffled, "상관없음").map((item) => item.slug)).toEqual(expected);
    }
  });
});
