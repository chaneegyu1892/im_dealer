import { describe, expect, it } from "vitest";
import { formatCarpan2SyncPlan } from "./report";

describe("formatCarpan2SyncPlan", () => {
  it("dry-run 리포트에 보호 항목과 무효 항목을 포함한다", () => {
    const report = formatCarpan2SyncPlan({
      sourcePath: "/tmp/carpan2.json",
      plan: {
        totals: {
          dbVehicles: 425,
          crawlVehicles: 407,
          dbTrims: 5248,
          crawlTrims: 6478,
          crawlLineups: 1871,
          catalogFiles: 423,
          priceFiles: 340,
          vehiclesWithImageLarge: 407,
          vehiclesWithCover: 407,
        },
        vehicleActions: {
          insertNew: 8,
          updateExisting: 398,
          preserveDbOnly: 27,
          skipInvalid: [
            {
              vehicleExternalId: "11858",
              brand: "애스턴마틴",
              name: "Valour",
              reason: "base price exceeds database Int range",
            },
          ],
        },
        trimActions: {
          insertNew: 1567,
          updateExisting: 4910,
          preserveDbOnly: 338,
          rewriteVisibilityCandidates: 1,
          skipInvalid: [],
        },
        ratedSafety: {
          ratedVehicles: 46,
          ratedTrims: 594,
          missingRatedVehicles: [],
          missingRatedTrims: [],
          stateChangedRatedTrims: [
            {
              vehicleExternalId: "11800",
              trimExternalId: "1053797",
              dbName: "Performance AWD",
              crawlName: "Performance AWD",
              crawlState: "3",
              activeRateSheetCount: 3,
            },
          ],
          valueChangedRatedTrims: [],
        },
      },
    });

    expect(report).toContain("카판2 차량 동기화 dry-run");
    expect(report).toContain("DB-only 차량 보존: 27");
    expect(report).toContain("회수율 보유 트림 state 위험: 1");
    expect(report).toContain("애스턴마틴 Valour");
    expect(report).toContain("쓰기 작업: 비활성화");
  });
});
