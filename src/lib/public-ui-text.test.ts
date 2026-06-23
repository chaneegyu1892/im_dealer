import { describe, expect, it } from "vitest";
import { summarizeVehicleDescription } from "./public-ui-text";

describe("summarizeVehicleDescription", () => {
  it("collapses whitespace and keeps short descriptions unchanged", () => {
    expect(summarizeVehicleDescription("  빠른 출고와 안정적인 월 납입금  ")).toBe(
      "빠른 출고와 안정적인 월 납입금",
    );
  });

  it("shortens long vehicle descriptions to a card-safe summary", () => {
    const text =
      "제네시스의 디자인 헤리티지 위에 더해진 정교화된 디테일, 라이프스타일에 대한 이해를 바탕으로 더욱 편안함이 느껴지는 사양을 더해 럭셔리 대형 세단의 품격을 높입니다.";

    const result = summarizeVehicleDescription(text);

    expect(result.length).toBeLessThanOrEqual(45);
    expect(result).toBe("제네시스의 디자인 헤리티지 위에 더해진 정교화된 디테일...");
  });

  it("returns an empty string for missing descriptions", () => {
    expect(summarizeVehicleDescription(null)).toBe("");
    expect(summarizeVehicleDescription(undefined)).toBe("");
  });
});
