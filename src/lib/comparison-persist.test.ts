// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  readSavedComparison,
  saveComparison,
  comparisonStorageKey,
  type SavedComparison,
} from "./comparison-persist";

const SAMPLE: SavedComparison = {
  isOpen: true,
  p2Slug: "sorento",
  p2TrimId: "trim-1",
  p2OptionIds: ["opt-1", "opt-2"],
  p2ExtColor: "color-ext",
  p2IntColor: "color-int",
  p2ProductType: "장기렌트",
};

describe("comparison-persist", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("저장 후 같은 기준 차량 키로 읽으면 그대로 복원된다", () => {
    saveComparison("grandeur", SAMPLE);
    expect(readSavedComparison("grandeur")).toEqual(SAMPLE);
  });

  it("다른 기준 차량 키로는 읽히지 않는다", () => {
    saveComparison("grandeur", SAMPLE);
    expect(readSavedComparison("sonata")).toBeNull();
  });

  it("저장본이 없으면 null", () => {
    expect(readSavedComparison("grandeur")).toBeNull();
  });

  it("손상된 JSON 이나 형식이 다른 값은 null 로 무시한다", () => {
    window.sessionStorage.setItem(comparisonStorageKey("grandeur"), "{broken");
    expect(readSavedComparison("grandeur")).toBeNull();

    window.sessionStorage.setItem(
      comparisonStorageKey("grandeur"),
      JSON.stringify({ p2Slug: 123 })
    );
    expect(readSavedComparison("grandeur")).toBeNull();
  });
});
