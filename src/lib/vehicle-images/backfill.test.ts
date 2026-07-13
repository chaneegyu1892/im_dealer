import { describe, expect, it } from "vitest";
import {
  isEligibleBackfillProjection,
  legacySourceKey,
  lockBackfillRows,
  planVehicleBackfill,
  runCoverBackfill,
  type BackfillVehicle,
} from "./backfill";
import { MemoryBackfillStore } from "./backfill-test-store";
import { registerHistoricalBackfillCases } from "./backfill-historical-cases";

function vehicle(overrides: Partial<BackfillVehicle> = {}): BackfillVehicle {
  return {
    id: "vehicle-1", name: "Vehicle One",
    thumbnailUrl: "",
    thumbnailImageId: null,
    imageRevision: 0,
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    imageUrls: [],
    images: [],
    ...overrides,
  };
}

function image(id: string, type: "MAIN" | "COVER", overrides: Partial<BackfillVehicle["images"][number]> = {}) {
  return {
    id,
    type,
    origin: "CARPAN2" as const,
    title: null,
    storageUrl: `https://mirror/${id}.webp`,
    sourceUrl: `https://source/${id}.webp`,
    sourceKey: `${type}:${id}`,
    adminStoragePath: null,
    displayOrder: 0,
    isVisible: true,
    deletedAt: null,
    ...overrides,
  };
}

describe("COVER representative backfill planning", () => {
  it("Given eligible MAIN and COVER When blank representative is planned Then COVER wins deterministically", () => {
    // Given
    const subject = vehicle({ images: [image("main", "MAIN"), image("cover-z", "COVER", { displayOrder: 2 }), image("cover-a", "COVER", { displayOrder: 1 })] });

    // When
    const plan = planVehicleBackfill(subject);

    // Then
    expect(plan.selection).toEqual({ kind: "existing", imageId: "cover-a", url: "https://mirror/cover-a.webp" });
  });

  it.each([
    ["hidden COVER", { isVisible: false }],
    ["deleted COVER", { deletedAt: new Date("2026-01-01") }],
    ["blank mirror COVER", { storageUrl: "   " }],
  ])("Given %s and eligible MAIN When planned Then MAIN is selected", (_label, coverState) => {
    // Given
    const subject = vehicle({ images: [image("cover", "COVER", coverState), image("main", "MAIN")] });

    // When
    const plan = planVehicleBackfill(subject);

    // Then
    expect(plan.selection).toEqual({ kind: "existing", imageId: "main", url: "https://mirror/main.webp" });
  });

  it.each([
    ["surrounding whitespace", " https://mirror.example/cover.webp "],
    ["HTTP", "http://mirror.example/cover.webp"],
    ["javascript", "javascript:alert(1)"],
    ["relative", "/cover.webp"],
    ["control character", "https://mirror.example/cover.webp\u0000"],
    ["encoded control character", "https://mirror.example/cover%00.webp"],
  ])("Given an active COVER with %s storage When planned Then it is reported invalid and never selected", (_label, storageUrl) => {
    // Given
    const subject = vehicle({ images: [image("cover", "COVER", { storageUrl }), image("main", "MAIN")] });

    // When
    const plan = planVehicleBackfill(subject);

    // Then
    expect(plan.selection).toEqual({ kind: "existing", imageId: "main", url: "https://mirror/main.webp" });
    expect(plan.invalidCandidateCount).toBe(1);
  });

  it("Given an ADMIN MAIN URL matching current thumbnail When planned twice Then it remains custom", () => {
    // Given
    const admin = image("admin", "MAIN", { origin: "ADMIN", sourceUrl: "/custom.webp", storageUrl: "/custom.webp", sourceKey: "admin:custom" });
    const subject = vehicle({ thumbnailUrl: " /custom.webp ", thumbnailImageId: "admin", images: [admin, image("cover", "COVER")] });

    // When
    const first = planVehicleBackfill(subject);
    const second = planVehicleBackfill(subject);

    // Then
    expect(first.classification).toBe("custom");
    expect(first.selection).toEqual({ kind: "existing", imageId: "admin", url: "/custom.webp" });
    expect(second.creates).toEqual([]);
  });

  it("Given linked ADMIN and CARPAN2 rows sharing the current URL When planned Then ADMIN provenance remains custom", () => {
    // Given
    const sharedUrl = "https://shared.example/image.webp";
    const admin = image("admin", "MAIN", { origin: "ADMIN", storageUrl: sharedUrl, sourceKey: "admin:shared" });
    const cover = image("cover", "COVER", { sourceUrl: sharedUrl, storageUrl: sharedUrl });

    // When
    const plan = planVehicleBackfill(vehicle({
      thumbnailUrl: sharedUrl,
      thumbnailImageId: admin.id,
      images: [admin, cover],
    }));

    // Then
    expect(plan.classification).toBe("custom");
    expect(plan.selection).toEqual({ kind: "existing", imageId: admin.id, url: sharedUrl });
    expect(plan.vehicleUpdate).toBe(false);
  });

  it("Given exact and near-match managed URLs When planned Then trim-only exact matching is used", () => {
    // Given
    const managed = image("cover", "COVER", { sourceUrl: "https://source/car.webp?x=1", storageUrl: " https://mirror/car.webp " });

    // When
    const exact = planVehicleBackfill(vehicle({ thumbnailUrl: "  https://source/car.webp?x=1 ", images: [managed] }));
    const near = planVehicleBackfill(vehicle({ thumbnailUrl: "https://source/car.webp?x=2", images: [managed] }));

    // Then
    expect(exact.classification).toBe("managed");
    expect(near.classification).toBe("custom");
  });

  it("Given custom thumbnail duplicated in imageUrls When planned Then one deterministic ADMIN MAIN row is reused", () => {
    // Given
    const subject = vehicle({ thumbnailUrl: " /legacy.webp ", imageUrls: [" /a.webp ", "/legacy.webp", "/a.webp", " "] });

    // When
    const plan = planVehicleBackfill(subject);

    // Then
    expect(plan.selection).toEqual({ kind: "legacy", sourceKey: legacySourceKey("/legacy.webp"), url: "/legacy.webp" });
    expect(plan.migrationRequired).toBe(false);
    expect(plan.creates.map(({ sourceKey, storageUrl, title, displayOrder }) => ({ sourceKey, storageUrl, title, displayOrder }))).toEqual([
      { sourceKey: legacySourceKey("/legacy.webp"), storageUrl: "/legacy.webp", title: "기존 대표 이미지", displayOrder: 1 },
      { sourceKey: legacySourceKey("/a.webp"), storageUrl: "/a.webp", title: "기존 이미지 1", displayOrder: 0 },
    ]);
  });

  it("Given an existing deterministic ADMIN legacy row When the same custom URL is adopted Then the row is reused", () => {
    // Given
    const key = legacySourceKey("/legacy.webp");
    const existing = image("legacy", "MAIN", {
      origin: "ADMIN",
      sourceKey: key,
      sourceUrl: "/legacy.webp",
      storageUrl: "/legacy.webp",
    });

    // When
    const plan = planVehicleBackfill(vehicle({ thumbnailUrl: "/legacy.webp", images: [existing] }));

    // Then
    expect(plan.creates).toEqual([]);
    expect(plan.selection).toEqual({ kind: "existing", imageId: existing.id, url: "/legacy.webp" });
  });

  it.each([
    ["source URL mismatch", { sourceUrl: "/wrong.webp" }],
    ["owned storage path", { adminStoragePath: "vehicle-images/owned.webp" }],
    ["stale display order", { displayOrder: 4 }],
  ])("Given a deterministic legacy row with %s When reused Then it fails closed", (_label, state) => {
    // Given
    const existing = image("legacy", "MAIN", {
      origin: "ADMIN",
      sourceKey: legacySourceKey("/legacy.webp"),
      sourceUrl: "/legacy.webp",
      storageUrl: "/legacy.webp",
      ...state,
    });

    // When
    const action = (): unknown => planVehicleBackfill(vehicle({ thumbnailUrl: "/legacy.webp", images: [existing] }));

    // Then
    expect(action).toThrow(/conflicts with an incompatible row/);
  });

  it("Given a linked deterministic legacy row with stale metadata When rerun Then reuse fails closed", () => {
    // Given
    const existing = image("legacy", "MAIN", {
      origin: "ADMIN",
      sourceKey: legacySourceKey("/legacy.webp"),
      sourceUrl: "/wrong.webp",
      storageUrl: "/legacy.webp",
    });

    // When
    const action = (): unknown => planVehicleBackfill(vehicle({ thumbnailUrl: "/legacy.webp", thumbnailImageId: existing.id, images: [existing] }));

    // Then
    expect(action).toThrow(/conflicts with an incompatible row/);
  });

  it("Given a custom representative absent from imageUrls When adopted Then representative is zero and gallery starts at one", () => {
    // Given
    const subject = vehicle({ thumbnailUrl: "/representative.webp", imageUrls: ["/a.webp", " /a.webp ", " ", "/b.webp"] });

    // When
    const plan = planVehicleBackfill(subject);

    // Then
    expect(plan.creates.map((entry) => [entry.storageUrl, entry.displayOrder])).toEqual([
      ["/representative.webp", 0],
      ["/a.webp", 1],
      ["/b.webp", 2],
    ]);
  });

  it("Given a stale incompatible row occupying a legacy key When adoption is planned Then it fails without overwrite", () => {
    // Given
    const stale = image("stale", "MAIN", {
      sourceKey: legacySourceKey("/legacy.webp"),
      storageUrl: "/different.webp",
    });

    // When
    const action = (): unknown => planVehicleBackfill(vehicle({ thumbnailUrl: "/legacy.webp", images: [stale] }));

    // Then
    expect(action).toThrow(/conflicts with an incompatible row/);
  });

  it("Given only an ADMIN COVER for a blank thumbnail When planned Then it is not a managed candidate", () => {
    // Given
    const adminCover = image("admin-cover", "COVER", { origin: "ADMIN" });

    // When
    const plan = planVehicleBackfill(vehicle({ images: [adminCover] }));

    // Then
    expect(plan.selection).toEqual({ kind: "preserve", imageId: null, url: "" });
    expect(plan.missing).toBe(true);
  });

  it("Given managed current URL with no eligible candidate When planned Then current is preserved and reported missing", () => {
    // Given
    const hidden = image("hidden", "COVER", { isVisible: false });

    // When
    const plan = planVehicleBackfill(vehicle({ thumbnailUrl: hidden.storageUrl, images: [hidden] }));

    // Then
    expect(plan.selection).toEqual({ kind: "preserve", imageId: null, url: hidden.storageUrl });
    expect(plan.missing).toBe(true);
    expect(plan.migrationRequired).toBe(true);
  });
});

describe("COVER representative readback", () => {
  const valid = {
    vehicleId: "vehicle-1",
    thumbnailUrl: "https://mirror.example/cover.webp",
    thumbnailImageId: "cover",
    thumbnailImage: {
      id: "cover",
      vehicleId: "vehicle-1",
      type: "COVER" as const,
      origin: "CARPAN2" as const,
      storageUrl: "https://mirror.example/cover.webp",
      isVisible: true,
      deletedAt: null,
    },
  };

  it.each([
    ["cross-vehicle owner", { thumbnailImage: { ...valid.thumbnailImage, vehicleId: "vehicle-2" } }],
    ["hidden image", { thumbnailImage: { ...valid.thumbnailImage, isVisible: false } }],
    ["deleted image", { thumbnailImage: { ...valid.thumbnailImage, deletedAt: new Date("2026-01-01") } }],
    ["wrong projection", { thumbnailUrl: "https://mirror.example/other.webp" }],
    ["invalid CARPAN2 type", { thumbnailImage: { ...valid.thumbnailImage, type: "SPEC_EXTERIOR" as const } }],
    ["invalid mirrored URL", { thumbnailImage: { ...valid.thumbnailImage, storageUrl: " http://mirror.example/cover.webp " }, thumbnailUrl: " http://mirror.example/cover.webp " }],
  ])("Given %s When projection is checked Then readback rejects it", (_label, override) => {
    // Given
    const row = { ...valid, ...override };

    // When
    const eligible = isEligibleBackfillProjection(row);

    // Then
    expect(eligible).toBe(false);
  });

  it("Given an active same-vehicle ADMIN MAIN projection When checked Then readback accepts it", () => {
    // Given
    const row = {
      ...valid,
      thumbnailUrl: "/legacy.webp",
      thumbnailImage: { ...valid.thumbnailImage, origin: "ADMIN" as const, type: "MAIN" as const, storageUrl: "/legacy.webp" },
    };

    // When
    const eligible = isEligibleBackfillProjection(row);

    // Then
    expect(eligible).toBe(true);
  });
});

describe("COVER representative backfill execution", () => {
  it("Given a vehicle with candidates When rows are locked Then Vehicle precedes sorted candidate IDs", async () => {
    // Given
    const calls: Array<{ readonly query: string; readonly values: readonly unknown[] }> = [];
    const client = {
      $queryRawUnsafe: async (query: string, ...values: unknown[]) => {
        calls.push({ query, values });
        return query.includes('FROM "Vehicle"') ? [{ id: "vehicle-1" }] : [{ id: "a" }, { id: "z" }];
      },
    };

    // When
    await lockBackfillRows(client, "vehicle-1");

    // Then
    expect(calls).toHaveLength(2);
    expect(calls[0]?.query).toContain('FROM "Vehicle"');
    expect(calls[1]?.query).toContain('ORDER BY "id" ASC FOR UPDATE');
    expect(calls.map((call) => call.values)).toEqual([["vehicle-1"], ["vehicle-1"]]);
  });

  it("Given a dry run When executed Then planned changes are reported with zero writes", async () => {
    // Given
    const store = new MemoryBackfillStore([vehicle({ images: [image("cover", "COVER")] })]);

    // When
    const report = await runCoverBackfill({ store, mode: "dry-run" });

    // Then
    expect(report.counts).toMatchObject({ plannedCreates: 0, plannedVehicleUpdates: 1, writes: 0 });
    expect(store.writes).toBe(0);
    expect(store.planCalls).toBe(1);
  });

  it("Given a forced transaction failure When apply runs Then no partial state is committed", async () => {
    // Given
    const initial = vehicle({ thumbnailUrl: "/custom.webp" });
    const store = new MemoryBackfillStore([initial]);
    store.fail = true;

    // When
    const action = runCoverBackfill({ store, mode: "apply" });

    // Then
    await expect(action).rejects.toThrow(/forced rollback/);
    expect(await store.loadVehicle(initial.id)).toEqual(initial);
    expect(store.writes).toBe(0);
  });
});
registerHistoricalBackfillCases();
