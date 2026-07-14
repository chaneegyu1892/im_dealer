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
