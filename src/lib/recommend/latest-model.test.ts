import { describe, expect, it } from "vitest";
import {
  filterLatestRecommendationTrims,
  getRecommendationModelKey,
  getRecommendationModelYear,
  latestByRecommendationModel,
  pickRecommendationTrim,
} from "./latest-model";
import type { RecommendationTrimCandidate } from "./latest-model";

const TRIMS_WITH_LINEUP: RecommendationTrimCandidate[] = [
  {
    name: "프리미엄",
    price: 42_000_000,
    isDefault: true,
    lineup: { name: "2025년형 가솔린 2.5", isVisible: true },
  },
  {
    name: "프리미엄",
    price: 43_000_000,
    isDefault: false,
    lineup: { name: "2026년형 가솔린 2.5", isVisible: true },
  },
  {
    name: "프리미엄",
    price: 44_000_000,
    isDefault: false,
    lineup: { name: "2026년형 하이브리드", isVisible: false },
  },
];

const TRIMS_WITH_NAME_YEAR: RecommendationTrimCandidate[] = [
  {
    name: "2025년형 가솔린 3.5 9인승 노블레스",
    price: 40_000_000,
    isDefault: true,
    lineup: { name: "일반 가솔린 9인승", isVisible: true },
  },
  {
    name: "2026년형 가솔린 3.5 9인승 노블레스",
    price: 41_000_000,
    isDefault: false,
    lineup: { name: "일반 가솔린 9인승", isVisible: true },
  },
];

describe("filterLatestRecommendationTrims", () => {
  it("라인업 연식 기준으로 최신 노출 트림만 남긴다", () => {
    const trims = filterLatestRecommendationTrims(TRIMS_WITH_LINEUP);

    expect(trims.map((trim) => trim.price)).toEqual([43_000_000]);
  });

  it("라인업에 연식이 없으면 트림명 연식 기준으로 최신 트림만 남긴다", () => {
    const trims = filterLatestRecommendationTrims(TRIMS_WITH_NAME_YEAR);

    expect(trims.map((trim) => trim.name)).toEqual([
      "2026년형 가솔린 3.5 9인승 노블레스",
    ]);
  });
});

describe("pickRecommendationTrim", () => {
  it("일반 추천은 최신 후보 중 기본 트림을 우선한다", () => {
    const trim = pickRecommendationTrim(TRIMS_WITH_LINEUP);

    expect(trim?.price).toBe(43_000_000);
  });

  it("고급 선호와 무관하게 최신 후보 중 기본 또는 가장 저렴한 트림을 선택한다", () => {
    const trim = pickRecommendationTrim(
      [
        ...TRIMS_WITH_LINEUP,
        {
          name: "시그니처",
          price: 47_000_000,
          isDefault: false,
          lineup: { name: "2026년형 가솔린 2.5", isVisible: true },
        },
      ]
    );

    expect(trim?.price).toBe(43_000_000);
  });
});

describe("latestByRecommendationModel", () => {
  it("같은 모델이면 점수가 낮아도 최신 연식을 남긴다", () => {
    const vehicles = latestByRecommendationModel([
      { modelKey: "기아:카니발", modelYear: 2025, score: 200 },
      { modelKey: "기아:카니발", modelYear: 2026, score: 120 },
      { modelKey: "현대:싼타페", modelYear: 2026, score: 130 },
    ]);

    expect(vehicles).toEqual([
      { modelKey: "기아:카니발", modelYear: 2026, score: 120 },
      { modelKey: "현대:싼타페", modelYear: 2026, score: 130 },
    ]);
  });
});

describe("recommendation model identity", () => {
  it("모델 키에서는 연식 표기를 제거하고 연식 값은 따로 계산한다", () => {
    const identity = {
      brand: "기아",
      name: "26년형 카니발",
      defaultTrimName: "2026년형 가솔린 3.5 9인승 노블레스",
      lineupName: "일반 가솔린 9인승",
    };

    expect(getRecommendationModelKey(identity)).toBe("기아:카니발");
    expect(getRecommendationModelYear(identity)).toBe(2026);
  });
});
