import { describe, expect, it } from "vitest";
import {
  buildOptionBadgeLookup,
  normalizeOptionName,
  summarizeVehicleOptions,
} from "./vehicle-option-badges";

describe("normalizeOptionName", () => {
  it("앞뒤 공백을 제거하고 연속 공백을 하나로 줄인다", () => {
    expect(normalizeOptionName("  파노라마  선루프 ")).toBe("파노라마 선루프");
    expect(normalizeOptionName("빌트인 캠\t2 Plus")).toBe("빌트인 캠 2 Plus");
  });
});

describe("buildOptionBadgeLookup", () => {
  const lookup = buildOptionBadgeLookup([
    { optionName: "파노라마 선루프", badge: { label: "추천" } },
    { optionName: "드라이브 와이즈", badge: { label: "베스트" } },
  ]);

  it("옵션명이 일치하면 배지를 돌려준다", () => {
    expect(lookup("파노라마 선루프")).toEqual({ label: "추천" });
  });

  it("트림마다 공백 표기가 달라도 같은 옵션명으로 매칭한다", () => {
    expect(lookup(" 파노라마  선루프")).toEqual({ label: "추천" });
  });

  it("매핑이 없으면 null", () => {
    expect(lookup("하이패스")).toBeNull();
  });
});

describe("summarizeVehicleOptions", () => {
  it("차량 전체 트림에서 옵션명 기준으로 중복을 제거하고 포함 트림 수를 센다", () => {
    // 하위 트림엔 선택옵션 5개, 상위 트림엔 일부가 기본화되어 옵션 수가 다른 명세 상황
    const rows = summarizeVehicleOptions([
      {
        options: [
          { name: "파노라마 선루프", category: "외관", isAccessory: false },
          { name: "드라이브 와이즈", category: "안전", isAccessory: false },
        ],
      },
      {
        options: [
          { name: "파노라마  선루프", category: "외관", isAccessory: false }, // 공백 표기 차이
        ],
      },
    ]);

    expect(rows).toEqual([
      { name: "드라이브 와이즈", category: "안전", isAccessory: false, trimCount: 1 },
      { name: "파노라마 선루프", category: "외관", isAccessory: false, trimCount: 2 },
    ]);
  });

  it("같은 트림 안의 중복 이름은 한 번만 센다", () => {
    const rows = summarizeVehicleOptions([
      {
        options: [
          { name: "하이패스", category: null, isAccessory: false },
          { name: "하이패스 ", category: null, isAccessory: false },
        ],
      },
    ]);
    expect(rows).toEqual([
      { name: "하이패스", category: null, isAccessory: false, trimCount: 1 },
    ]);
  });

  it("빈 이름은 무시한다", () => {
    expect(
      summarizeVehicleOptions([{ options: [{ name: "  ", category: null, isAccessory: false }] }])
    ).toEqual([]);
  });
});
