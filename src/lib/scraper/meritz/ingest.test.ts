import { describe, it, expect, vi } from "vitest";
import { ingestMeritzRent, type MappedPriceByMdelCd } from "./ingest";
import type { OurVehicle } from "./match";

// 워크북 파싱은 모킹 — 가격 주입 우선순위(확정 매핑 > 이름 매칭)만 검증
vi.mock("./parse", () => ({
  parseMeritzRentWorkbook: () => ({
    trims: [
      {
        manufacturer: "기아", name: "카니발 9인승",
        gaesoseK: 1.1, insGrade: "승합", strategy: "기본", fuel: "가솔린", disp: 3470,
        mfrDiscount: 0, rvGroup: "7", residual: {}, irrAdj: {}, deliveryFeeSeoul: 0, evSubsidy: 0,
      },
    ],
    constants: { strategyBaseRate: { 기본: 0.065 } },
  }),
}));

const BUF = Buffer.alloc(0);
const MDEL_CD = "기아_카니발9인승"; // norm(manufacturer + "_" + name)

describe("ingestMeritzRent 가격 주입 우선순위", () => {
  it("확정 매핑이 있으면 이름 매칭 없이 매핑된 트림 가격을 주입한다", () => {
    const mapped: MappedPriceByMdelCd = new Map([[MDEL_CD, { trimId: "t1", price: 50_000_000 }]]);
    const r = ingestMeritzRent(BUF, [], mapped);
    expect(r.entries[0].mdelCd).toBe(MDEL_CD);
    expect(r.entries[0].vehiclePrice).toBe(50_000_000);
    expect(r.entries[0].warnings).toEqual([]);
    expect(r.summary.mappedConfirmed).toBe(1);
    expect(r.summary.unmatched).toBe(0);
  });

  it("매핑이 없으면 이름 매칭으로 폴백하고, 실패 시 미매칭 목록에 남긴다", () => {
    const r = ingestMeritzRent(BUF, [] as OurVehicle[]);
    expect(r.entries[0].vehiclePrice).toBe(0);
    expect(r.summary.mappedConfirmed).toBe(0);
    expect(r.summary.unmatched).toBe(1);
    expect(r.summary.unmatchedNames).toEqual(["카니발 9인승"]);
  });
});
