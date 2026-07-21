import { describe, expect, it } from "vitest";
import type { VehicleListItem } from "@/types/api";
import { getVehicleCardPoints } from "./vehicle-card-points";

type PointInput = Pick<VehicleListItem, "name" | "defaultTrim" | "hashtags">;

function makeVehicle(overrides: Partial<PointInput> = {}): PointInput {
  return {
    name: "테스트 세단",
    defaultTrim: {
      name: "프리미엄",
      price: 40_000_000,
      engineType: "가솔린",
      fuelEfficiency: 12,
      specs: null,
    },
    hashtags: ["#인기", "#세단"],
    ...overrides,
  };
}

describe("getVehicleCardPoints", () => {
  it("HEV 차량명은 원천 엔진이 가솔린이어도 하이브리드 하나로 통일한다", () => {
    expect(getVehicleCardPoints(makeVehicle({ name: "더 뉴 그랜저 HEV" }))).toEqual([
      "#하이브리드",
      "#프리미엄",
      "#인기",
    ]);
  });

  it("EV 엔진은 전기차 포인트로 표시하고 중복 태그를 제거한다", () => {
    expect(
      getVehicleCardPoints(
        makeVehicle({
          name: "아이오닉 5",
          defaultTrim: {
            name: "2026년형 롱레인지 2WD",
            price: 50_000_000,
            engineType: "EV",
            fuelEfficiency: 5.2,
            specs: { trimName: "롱레인지" },
          },
          hashtags: ["#전기차", "인기"],
        }),
      ),
    ).toEqual(["#전기차", "#롱레인지", "#인기"]);
  });

  it("긴 원문 트림명 대신 구조화된 짧은 등급명을 사용한다", () => {
    expect(
      getVehicleCardPoints(
        makeVehicle({
          name: "카니발",
          defaultTrim: {
            name: "2026년형 가솔린 3.5 9인승 노블레스",
            price: 40_710_000,
            engineType: "가솔린",
            fuelEfficiency: 9,
            specs: { trimName: "노블레스" },
          },
        }),
      ),
    ).toEqual(["#가솔린", "#노블레스", "#인기"]);
  });

  it("구조화된 등급명이 없으면 긴 원문 트림명을 노출하지 않는다", () => {
    const points = getVehicleCardPoints(
      makeVehicle({
        defaultTrim: {
          name: "2026년형 가솔린 3.5 9인승 노블레스",
          price: 40_710_000,
          engineType: "가솔린",
          fuelEfficiency: 9,
          specs: null,
        },
      }),
    );

    expect(points).toEqual(["#가솔린", "#인기", "#세단"]);
    expect(points.join(" ")).not.toContain("2026년형");
  });

  it("타입 밖의 수소 원천 데이터도 가솔린으로 오표시하지 않는다", () => {
    expect(
      getVehicleCardPoints(
        makeVehicle({
          name: "디 올 뉴 넥쏘",
          defaultTrim: {
            name: "익스클루시브",
            price: 72_000_000,
            engineType: "가솔린",
            fuelEfficiency: null,
            specs: null,
          },
        }),
      ),
    ).toEqual(["#수소차", "#익스클루시브", "#인기"]);
  });
});
