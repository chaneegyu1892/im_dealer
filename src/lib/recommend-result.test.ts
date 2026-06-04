import { describe, it, expect } from "vitest";
import { parseStoredResult } from "./recommend-result";

const validVehicle = {
  vehicleId: "veh_1",
  rank: 1,
  score: 70,
  reason: "조건에 적합한 차량이에요",
  highlights: ["고연비"],
  estimatedMonthly: 760000,
  vehicle: { slug: "genesis-g80", name: "제네시스 G80" },
  scenarios: { standard: { monthlyPayment: 760000 } },
};

describe("parseStoredResult", () => {
  it("null/undefined 는 null 반환 (옛 로그 → 재계산 폴백 신호)", () => {
    expect(parseStoredResult(null)).toBeNull();
    expect(parseStoredResult(undefined)).toBeNull();
  });

  it("유효한 결과 배열은 그대로 반환", () => {
    const result = parseStoredResult([validVehicle]);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result?.[0].vehicleId).toBe("veh_1");
  });

  it("빈 배열은 유효한 frozen 결과로 [] 반환 (null 아님)", () => {
    expect(parseStoredResult([])).toEqual([]);
  });

  it("배열이 아니면 null", () => {
    expect(parseStoredResult({ vehicleId: "veh_1" })).toBeNull();
    expect(parseStoredResult("garbage")).toBeNull();
    expect(parseStoredResult(42)).toBeNull();
  });

  it("필수 필드(vehicleId) 누락 항목이 있으면 null", () => {
    const missingId: Record<string, unknown> = { ...validVehicle };
    delete missingId.vehicleId;
    expect(parseStoredResult([missingId])).toBeNull();
  });

  it("vehicle.slug 누락이면 null (견적 링크 깨짐 방지)", () => {
    const noSlug = { ...validVehicle, vehicle: { name: "이름만" } };
    expect(parseStoredResult([noSlug])).toBeNull();
  });
});
