import { describe, expect, it } from "vitest";
import { buildExistingVehicleApplyPolicy } from "./apply-policy";

describe("buildExistingVehicleApplyPolicy", () => {
  it("기존 DB 차량만 적용 대상으로 고르고 운영 수동 필드는 업데이트 payload에서 제외한다", () => {
    const policy = buildExistingVehicleApplyPolicy({
      dbVehicles: [
        {
          externalId: "11573",
          brand: "기아",
          name: "더 뉴 쏘렌토 HEV",
          isVisible: true,
          trims: [],
        },
      ],
      crawlVehicles: [
        {
          modelId: "11573",
          brandName: "기아",
          modelName: "더 뉴 쏘렌토 HEV",
          cartypeCode: "R5",
          engineCode: "GX",
          state: "2",
          summary: "updated summary",
          priceMin: 38240000,
          imageLarge: "https://www.carpan.co.kr/img/model/sorento-L.png",
          cover: "https://www.carpan.co.kr/img/model/sorento-cover.png",
          catalogFileCount: 1,
          priceFileCount: 1,
          catalogFiles: [],
          priceFiles: [],
          options: [],
          exteriorColors: [],
          interiorColors: [],
          lineups: [],
          trims: [],
        },
        {
          modelId: "11881",
          brandName: "KG모빌리티",
          modelName: "뉴 토레스 HEV",
          cartypeCode: "R5",
          engineCode: "GX",
          state: "2",
          summary: null,
          priceMin: 35500000,
          imageLarge: "https://www.carpan.co.kr/img/model/torres-L.png",
          cover: "https://www.carpan.co.kr/img/model/torres-cover.png",
          catalogFileCount: 0,
          priceFileCount: 0,
          catalogFiles: [],
          priceFiles: [],
          options: [],
          exteriorColors: [],
          interiorColors: [],
          lineups: [],
          trims: [],
        },
      ],
    });

    expect(policy.vehicleExternalIds).toEqual(["11573"]);
    expect(policy.skippedNewVehicles).toBe(1);
    expect(policy.skippedInvalidVehicles).toEqual([]);
    expect(policy.vehicleUpdate).toEqual({
      name: "더 뉴 쏘렌토 HEV",
      brand: "기아",
      category: "SUV",
      externalSource: "carpan2",
      basePrice: 38240000,
      thumbnailUrl: "https://www.carpan.co.kr/img/model/sorento-L.png",
      imageUrls: [
        "https://www.carpan.co.kr/img/model/sorento-L.png",
        "https://www.carpan.co.kr/img/model/sorento-cover.png",
      ],
      description: "updated summary",
    });
    expect(policy.vehicleUpdate).not.toHaveProperty("isVisible");
    expect(policy.vehicleUpdate).not.toHaveProperty("isPopular");
    expect(policy.vehicleUpdate).not.toHaveProperty("isSpotlight");
    expect(policy.vehicleUpdate).not.toHaveProperty("displayOrder");
    expect(policy.vehicleUpdate).not.toHaveProperty("surchargeRate");
    expect(policy.vehicleUpdate).not.toHaveProperty("vehicleCode");
  });
});
