import { describe, it, expect } from "vitest";
import { matchMeritzTrim, type OurVehicle } from "./match";

// 실제 카니발 사례 축약 — 코어("카니발")가 같은 파생 차량 2대(HEV vs 일반)와
// 라인업명(연료·배기량·인승·차체)이 차종을 구분하는 구조. 비싼 트림을 앞에 배치해
// 폴백이 배열 순서가 아닌 최저가 기준임을 함께 검증.
const vehicles: OurVehicle[] = [
  {
    id: "v-hev",
    brand: "기아",
    name: "더 뉴 카니발 HEV",
    trims: [
      { id: "hev-s9", name: "시그니처", price: 48_110_000, lineupName: "[2025년형 가솔린 1.6 터보 9인승]" },
      { id: "hev-p9", name: "프레스티지", price: 40_060_000, lineupName: "[2025년형 가솔린 1.6 터보 9인승]" },
      { id: "hev-n7", name: "노블레스 아웃도어", price: 46_010_000, lineupName: "[2025년형 가솔린 1.6 터보 7인승 (개소세 5% 기준)]" },
      { id: "hev-limo4", name: "시그니처", price: 98_310_000, lineupName: "[2025년형 하이리무진 가솔린 1.6 터보 4인승 (개소세 5% 기준)]" },
      { id: "hev-roof9", name: "노블레스", price: 56_660_000, lineupName: "[2026년형 하이루프 가솔린 1.6 터보 9인승]" },
    ],
  },
  {
    id: "v-normal",
    brand: "기아",
    name: "더 뉴 카니발",
    trims: [
      { id: "d9-p", name: "프레스티지", price: 37_460_000, lineupName: "[2025년형 디젤 2.2 9인승]" },
      { id: "g9-n", name: "노블레스", price: 39_910_000, lineupName: "[2025년형 가솔린 3.5 9인승]" },
      { id: "g9-p", name: "프레스티지", price: 35_510_000, lineupName: "[2025년형 가솔린 3.5 9인승]" },
    ],
  },
];

describe("matchMeritzTrim — 차종(연료·배기량·인승·차체) 구분", () => {
  it("하이브리드는 HEV 차량의 해당 인승 base 가격", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 1.6T 하이브리드 9인승" }, vehicles);
    expect(m!.trimId).toBe("hev-p9");
    expect(m!.price).toBe(40_060_000);
    expect(m!.trimMatched).toBe(false);
  });

  it("디젤은 일반 카니발의 디젤 라인업 가격 — HEV 차량으로 새지 않는다", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 2.2 디젤 9인승" }, vehicles);
    expect(m!.vehicleId).toBe("v-normal");
    expect(m!.trimId).toBe("d9-p");
    expect(m!.price).toBe(37_460_000);
  });

  it("3.5 가솔린은 일반 카니발의 가솔린 3.5 base 가격", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 3.5 가솔린 9인승" }, vehicles);
    expect(m!.trimId).toBe("g9-p");
    expect(m!.price).toBe(35_510_000);
  });

  it("하이리무진은 하이리무진 라인업만 — 하이루프·일반과 섞이지 않는다", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 1.6T 하이브리드 하이리무진 4인승" }, vehicles);
    expect(m!.trimId).toBe("hev-limo4");
    expect(m!.price).toBe(98_310_000);
  });

  it("인승이 다르면 해당 인승 라인업으로 간다", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 1.6T 하이브리드 7인승" }, vehicles);
    expect(m!.trimId).toBe("hev-n7");
    expect(m!.price).toBe(46_010_000);
  });

  it("등급 토큰이 있으면 차종 안에서 등급까지 매칭한다", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 3.5 가솔린 노블레스" }, vehicles);
    expect(m!.trimId).toBe("g9-n");
    expect(m!.price).toBe(39_910_000);
    expect(m!.trimMatched).toBe(true);
  });

  it("차종 토큰이 전혀 안 맞으면 기존처럼 모델 base 가격 폴백", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "더 뉴 카니발 11인승" }, vehicles);
    expect(m).not.toBeNull();
    expect(m!.trimMatched).toBe(false);
  });

  it("모델을 못 찾으면 null", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "쏘렌토 2.5 가솔린" }, vehicles);
    expect(m).toBeNull();
  });
});
