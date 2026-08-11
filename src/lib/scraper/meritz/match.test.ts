import { describe, it, expect } from "vitest";
import { matchMeritzTrim, type OurVehicle } from "./match";

// 비싼 트림을 배열 앞에 배치 — 폴백이 배열 순서가 아닌 최저가 기준임을 검증
const vehicles: OurVehicle[] = [
  {
    id: "v-carnival",
    brand: "기아",
    name: "카니발",
    trims: [
      { id: "t-high", name: "3.5 가솔린 시그니처", price: 65_000_000, lineupName: "하이리무진" },
      { id: "t-base", name: "프레스티지", price: 45_260_000, lineupName: "가솔린 3.5" },
    ],
  },
];

describe("matchMeritzTrim", () => {
  it("트림 토큰이 일치하면 해당 트림 가격을 사용한다", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "카니발 3.5 가솔린 시그니처" }, vehicles);
    expect(m).not.toBeNull();
    expect(m!.trimId).toBe("t-high");
    expect(m!.price).toBe(65_000_000);
    expect(m!.trimMatched).toBe(true);
  });

  it("트림 미확정 폴백은 배열 순서와 무관하게 최저가(base) 트림 가격을 쓴다", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "카니발 9인승" }, vehicles);
    expect(m).not.toBeNull();
    expect(m!.trimId).toBe("t-base");
    expect(m!.price).toBe(45_260_000);
    expect(m!.trimMatched).toBe(false);
  });

  it("모델을 못 찾으면 null", () => {
    const m = matchMeritzTrim({ manufacturer: "기아", name: "쏘렌토 2.5 가솔린" }, vehicles);
    expect(m).toBeNull();
  });
});
