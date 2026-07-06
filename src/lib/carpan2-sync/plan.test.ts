import { describe, expect, it } from "vitest";
import { buildCarpan2SyncPlan } from "./plan";
import type { CrawlTrimSnapshot, CrawlVehicleSnapshot } from "./types";

describe("buildCarpan2SyncPlan", () => {
  it("회수율이 있는 기존 트림은 크롤링 state가 단종이어도 보호 위험으로 분류한다", () => {
    const plan = buildCarpan2SyncPlan({
      dbVehicles: [
        {
          externalId: "11800",
          brand: "테슬라",
          name: "New Model 3",
          isVisible: true,
          trims: [
            {
              externalId: "1053797",
              name: "Performance AWD",
              price: 70000000,
              isVisible: true,
              activeRateSheetCount: 3,
            },
          ],
        },
      ],
      crawlVehicles: [
        crawlVehicle({
          modelId: "11800",
          brandName: "테슬라",
          modelName: "New Model 3",
          trims: [
            crawlTrim({
              trimId: "1053797",
              lineupId: "119000",
              name: "Performance AWD",
              price: 70000000,
              state: "3",
            }),
          ],
        }),
      ],
    });

    expect(plan.ratedSafety.ratedTrims).toBe(1);
    expect(plan.ratedSafety.stateChangedRatedTrims).toEqual([
      {
        vehicleExternalId: "11800",
        trimExternalId: "1053797",
        dbName: "Performance AWD",
        crawlName: "Performance AWD",
        crawlState: "3",
        activeRateSheetCount: 3,
      },
    ]);
    expect(plan.trimActions.updateExisting).toBe(1);
    expect(plan.trimActions.rewriteVisibilityCandidates).toBe(1);
  });

  it("신규/DB-only/무효 데이터를 실제 적용 후보와 보존 후보로 나눈다", () => {
    const plan = buildCarpan2SyncPlan({
      dbVehicles: [
        {
          externalId: "10000",
          brand: "현대",
          name: "DB에만 있는 차",
          isVisible: false,
          trims: [
            {
              externalId: "90000",
              name: "구형 트림",
              price: 30000000,
              isVisible: false,
              activeRateSheetCount: 0,
            },
          ],
        },
      ],
      crawlVehicles: [
        crawlVehicle({
          modelId: "11881",
          brandName: "KG모빌리티",
          modelName: "뉴 토레스 HEV",
          priceMin: 35500000,
          trims: [
            crawlTrim({
              trimId: "1059001",
              lineupId: "119001",
              name: "C5",
              price: 35500000,
              state: "2",
            }),
          ],
        }),
        crawlVehicle({
          modelId: "11858",
          brandName: "애스턴마틴",
          modelName: "Valour",
          priceMin: 2893700000,
          trims: [
            crawlTrim({
              trimId: "1058001",
              lineupId: "119002",
              name: "V12 M/T",
              price: 2893700000,
              state: "2",
            }),
          ],
        }),
      ],
    });

    expect(plan.vehicleActions.insertNew).toBe(1);
    expect(plan.vehicleActions.preserveDbOnly).toBe(1);
    expect(plan.vehicleActions.skipInvalid).toEqual([
      {
        vehicleExternalId: "11858",
        brand: "애스턴마틴",
        name: "Valour",
        reason: "base price exceeds database Int range",
      },
    ]);
    expect(plan.trimActions.insertNew).toBe(1);
    expect(plan.trimActions.preserveDbOnly).toBe(1);
    expect(plan.trimActions.skipInvalid).toEqual([
      {
        vehicleExternalId: "11858",
        trimExternalId: "1058001",
        name: "V12 M/T",
        reason: "trim price exceeds database Int range",
      },
    ]);
  });
});

function crawlVehicle(overrides: Partial<CrawlVehicleSnapshot>): CrawlVehicleSnapshot {
  return {
    modelId: "vehicle-id",
    brandName: "브랜드",
    modelName: "모델",
    cartypeCode: "R5",
    engineCode: "G",
    state: "2",
    summary: null,
    priceMin: 30000000,
    imageLarge: "https://www.carpan.co.kr/img/model/default-L.png",
    cover: "https://www.carpan.co.kr/img/model/default-cover.png",
    catalogFileCount: 0,
    priceFileCount: 0,
    catalogFiles: [],
    priceFiles: [],
    options: [],
    exteriorColors: [],
    interiorColors: [],
    lineups: [],
    trims: [],
    ...overrides,
  };
}

function crawlTrim(overrides: Partial<CrawlTrimSnapshot>): CrawlTrimSnapshot {
  return {
    trimId: "trim-id",
    lineupId: null,
    name: "트림",
    price: 30000000,
    state: "2",
    engineCode: "G",
    displace: null,
    person: null,
    carry: null,
    options: [],
    ...overrides,
  };
}
