import type { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  importLegacyVehicleColors,
  type LegacyColorImportStore,
} from "./legacy-import-colors";
import {
  importLegacyLineupsAndTrims,
  type LegacyTrimImportStore,
} from "./legacy-import-trims";
import {
  createLegacyImportStats,
  type ExternalModel,
  type ExternalModelEntry,
} from "./legacy-import-types";

function createTrimStore(writes: {
  readonly lineups: Prisma.VehicleLineupUpsertArgs[];
  readonly trims: Prisma.TrimUpsertArgs[];
  readonly options: Prisma.TrimOptionUpsertArgs[];
}): LegacyTrimImportStore {
  return {
    vehicleLineup: {
      upsert: async (args) => {
        writes.lineups.push(args);
        return { id: `lineup-${writes.lineups.length}` };
      },
    },
    trim: {
      upsert: async (args) => {
        writes.trims.push(args);
        return { id: `trim-${writes.trims.length}` };
      },
    },
    trimOption: {
      upsert: async (args) => {
        writes.options.push(args);
        return { id: `option-${writes.options.length}` };
      },
    },
  };
}

describe("legacy vehicle import behavior", () => {
  it("preserves lineup, trim, option, document, and color-price writes", async () => {
    // Given: one baseline lineup/trim/option fixture and an executable in-memory store.
    const writes = {
      lineups: [] as Prisma.VehicleLineupUpsertArgs[],
      trims: [] as Prisma.TrimUpsertArgs[],
      options: [] as Prisma.TrimOptionUpsertArgs[],
    };
    const modelDetail: ExternalModel = {
      engine: "D",
      efficiency: { diesel: { min: "10", max: "12" } },
    };
    const modelEntry: ExternalModelEntry = {
      modelId: "101",
      detail: {
        lineup: { l1: { name: "2026년형" } },
        trim: {
          t1: {
            lineup: "l1",
            name: "프리미엄",
            price: "42,000,000",
            state: "2",
            items: "d1",
            itemsLink: "d2",
            colorExt: "e1\t700000\t",
            colorInt: "i1\t300000\t",
            option: "o1\t500000\tcondition\tflag",
          },
        },
        option: {
          o1: {
            name: "선루프",
            kind: "A",
            apply: "적용",
            guide: "안내",
            package: "패키지",
            packageRemark: "비고",
          },
        },
        document: { d1: { content: "본문" }, d2: { remark: "참고" } },
      },
    };
    const stats = createLegacyImportStats();

    // When: the extracted importer writes the fixture through the real orchestration.
    const result = await importLegacyLineupsAndTrims({
      prisma: createTrimStore(writes),
      vehicleId: "vehicle-1",
      modelEntry,
      modelDetail,
      stats,
    });

    // Then: the pre-extraction non-image write contract is unchanged.
    expect(writes.lineups).toHaveLength(1);
    expect(writes.lineups[0]?.create).toMatchObject({
      vehicleId: "vehicle-1",
      name: "2026년형",
      externalId: "l1",
      metadata: { name: "2026년형" },
    });
    expect(writes.trims[0]?.create).toMatchObject({
      vehicleId: "vehicle-1",
      lineupId: "lineup-1",
      name: "프리미엄",
      price: 42_000_000,
      engineType: "디젤",
      fuelEfficiency: 11,
      externalId: "t1",
      isVisible: true,
    });
    expect(writes.trims[0]?.create.detailedSpecs).toMatchObject({
      externalRaw: {
        documents: [{ content: "본문" }, { remark: "참고" }],
        colorPriceMap: {
          ext: [{ id: "e1", priceDelta: 700_000, flag: "" }],
          int: [{ id: "i1", priceDelta: 300_000, flag: "" }],
        },
      },
    });
    expect(writes.options[0]?.create).toMatchObject({
      trimId: "trim-1",
      name: "선루프",
      price: 500_000,
      category: "악세서리",
      isAccessory: true,
      description: "적용\n\n안내\n\n패키지",
      externalId: "o1",
    });
    expect(result.trimColorPriceExt.get("e1")).toBe(700_000);
    expect(result.trimColorPriceInt.get("i1")).toBe(300_000);
    expect(stats).toMatchObject({ lineups: 1, trims: 1, options: 1 });
  });

  it("preserves exterior and interior color merge, ordering, and counts", async () => {
    // Given: model colors whose domestic trim prices exercise the established max merge.
    const writes: Prisma.VehicleColorUpsertArgs[] = [];
    const prisma: LegacyColorImportStore = {
      vehicleColor: {
        upsert: async (args) => {
          writes.push(args);
          return { id: `color-${writes.length}` };
        },
      },
    };
    const modelDetail: ExternalModel = {
      colorExt: "e1\t100000\t\ne-missing\t900000\t",
      colorInt: "i1\t200000\t",
    };
    const modelEntry: ExternalModelEntry = {
      modelId: "101",
      detail: {
        colorExt: {
          e1: { name: "외장", code: "E1", rgb: "FFFFFF", rgb2: "EEEEEE" },
        },
        colorInt: { i1: { name: "내장", rgb: "111111", rgb2: "222222" } },
      },
    };
    const stats = createLegacyImportStats();

    // When: domestic trim prices are merged into vehicle-level colors.
    const rowCount = await importLegacyVehicleColors({
      prisma,
      vehicleId: "vehicle-1",
      modelEntry,
      modelDetail,
      mergeTrimColors: true,
      trimColorPriceExt: new Map([["e1", 300_000]]),
      trimColorPriceInt: new Map([["i1", 150_000]]),
      stats,
    });

    // Then: valid writes, max-price policy, per-kind ordering, and legacy row count match.
    expect(writes).toHaveLength(2);
    expect(writes[0]?.create).toMatchObject({
      vehicleId: "vehicle-1",
      kind: "EXTERIOR",
      externalId: "e1",
      name: "외장",
      hexCode: "#FFFFFF",
      priceDelta: 300_000,
      sortOrder: 0,
      mfgCode: "E1",
    });
    expect(writes[1]?.create).toMatchObject({
      vehicleId: "vehicle-1",
      kind: "INTERIOR",
      externalId: "i1",
      name: "내장",
      hexCode: "#111111",
      priceDelta: 200_000,
      sortOrder: 0,
    });
    expect(rowCount).toBe(3);
    expect(stats.colors).toBe(2);
  });
});
