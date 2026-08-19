import { describe, expect, it } from "vitest";
import {
  filterLatestPublicTrims,
  getCarpan2TrimState,
  isCarpan2TrimCurrentlySold,
} from "./vehicle-visibility-policy";

function trim(
  id: string,
  year: number,
  options: { trimVisible?: boolean; lineupVisible?: boolean } = {},
) {
  return {
    id,
    isVisible: options.trimVisible ?? true,
    lineup: {
      name: `${year}년형 롱레인지`,
      isVisible: options.lineupVisible ?? true,
    },
  };
}

describe("filterLatestPublicTrims", () => {
  it("트림과 라인업이 모두 공개된 최신 연식만 남긴다", () => {
    const result = filterLatestPublicTrims([
      trim("old-hidden-lineup", 2025, { lineupVisible: false }),
      trim("latest", 2027),
      trim("latest-hidden-trim", 2027, { trimVisible: false }),
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["latest"]);
  });

  it("라인업 없는 수동 트림은 유지한다", () => {
    const manual = { id: "manual", isVisible: true, lineup: null };
    expect(filterLatestPublicTrims([manual])).toEqual([manual]);
  });
});

function pricedTrim(
  id: string,
  year: number,
  price: number,
  options: { lineupVisible?: boolean } = {},
) {
  return {
    id,
    price,
    isVisible: true,
    lineup: {
      name: `${year}년형 가솔린`,
      isVisible: options.lineupVisible ?? true,
    },
  };
}

describe("카드 최저가 트림과 견적 트림 집합 정합", () => {
  it("다연식 차량의 카드 최저가 트림은 견적 페이지 최신 연식 집합에 포함된다", () => {
    const publicTrims = [
      pricedTrim("old-cheap", 2025, 28_000_000),
      pricedTrim("latest-mid", 2027, 34_000_000),
      pricedTrim("latest-high", 2027, 41_000_000),
    ];

    const quoteTrims = filterLatestPublicTrims(publicTrims);
    const cardTrims = filterLatestPublicTrims(publicTrims);
    const cardLowest = [...cardTrims].sort((a, b) => a.price - b.price)[0];

    expect(cardLowest?.id).toBe("latest-mid");
    expect(quoteTrims.map((entry) => entry.id)).toEqual(["latest-mid", "latest-high"]);
    expect(quoteTrims.some((entry) => entry.id === cardLowest?.id)).toBe(true);
  });

  it("구형만 공개된 차량은 목록에서 빠지지 않고 그 구형 트림을 표시한다", () => {
    const publicTrims = [
      pricedTrim("old-only", 2024, 31_000_000),
      pricedTrim("hidden-new", 2027, 39_000_000, { lineupVisible: false }),
    ];

    const displayed = filterLatestPublicTrims(publicTrims);

    expect(displayed.map((entry) => entry.id)).toEqual(["old-only"]);
    expect(displayed).toHaveLength(1);
  });
});

describe("Carpan2 trim state", () => {
  it("state=2만 판매 중으로 해석한다", () => {
    expect(getCarpan2TrimState({ externalRaw: { state: "2" } })).toBe("2");
    expect(isCarpan2TrimCurrentlySold({ externalRaw: { state: "2" } })).toBe(true);
    expect(isCarpan2TrimCurrentlySold({ externalRaw: { state: "3" } })).toBe(false);
  });

  it("상태를 알 수 없는 수동 데이터는 null로 보존한다", () => {
    expect(getCarpan2TrimState(null)).toBeNull();
    expect(isCarpan2TrimCurrentlySold({ externalRaw: {} })).toBeNull();
  });
});
