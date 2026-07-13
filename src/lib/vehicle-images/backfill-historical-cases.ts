import { describe, expect, it } from "vitest";
import {
  planVehicleBackfill,
  runCoverBackfill,
  type BackfillVehicle,
} from "./backfill";
import { MemoryBackfillStore } from "./backfill-test-store";

function carpanImage(id: string, type: "MAIN" | "COVER", state: Partial<BackfillVehicle["images"][number]> = {}) {
  return {
    id,
    type,
    origin: "CARPAN2" as const,
    title: null,
    storageUrl: `https://mirror.example/${id}.webp`,
    sourceUrl: `https://source.example/${id}.webp`,
    sourceKey: `${type}:${id}`,
    adminStoragePath: null,
    displayOrder: 0,
    isVisible: true,
    deletedAt: null,
    ...state,
  };
}

function historicalVehicle(overrides: Partial<BackfillVehicle> = {}): BackfillVehicle {
  const main = carpanImage("main", "MAIN");
  const cover = carpanImage("cover", "COVER");
  return {
    id: "historical",
    name: "Historical Shape",
    thumbnailUrl: main.sourceUrl ?? "",
    thumbnailImageId: null,
    imageRevision: 0,
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    imageUrls: [main.sourceUrl ?? "", cover.sourceUrl ?? ""],
    images: [main, cover],
    ...overrides,
  };
}

export function registerHistoricalBackfillCases(): void {
  describe("historical Carpan2 legacy URL adoption", () => {
    it("Given imageLarge and COVER legacy URLs matching eligible CARPAN2 rows When planned Then rows are reused without ADMIN duplicates", () => {
      // Given
      const subject = historicalVehicle();

      // When
      const plan = planVehicleBackfill(subject);

      // Then
      expect(plan.creates).toEqual([]);
      expect(plan.selection).toEqual({ kind: "existing", imageId: "cover", url: "https://mirror.example/cover.webp" });
      expect(plan.blockedLegacyUrlCount).toBe(0);
    });

    it.each([
      ["hidden", { isVisible: false }],
      ["deleted", { deletedAt: new Date("2026-01-01") }],
    ])("Given a legacy URL matching %s CARPAN2 COVER When planned Then it is blocked instead of adopted as ADMIN", (_label, state) => {
      // Given
      const cover = carpanImage("cover", "COVER", state);
      const main = carpanImage("main", "MAIN");
      const subject = historicalVehicle({ imageUrls: [cover.sourceUrl ?? ""], images: [main, cover] });

      // When
      const plan = planVehicleBackfill(subject);

      // Then
      expect(plan.creates).toEqual([]);
      expect(plan.blockedLegacyUrlCount).toBe(1);
      expect(plan.selection).toEqual({ kind: "existing", imageId: "main", url: "https://mirror.example/main.webp" });
    });

    it("Given the historical shape When apply runs twice Then no ADMIN row is created and the second run writes zero", async () => {
      // Given
      const store = new MemoryBackfillStore([historicalVehicle()]);

      // When
      const first = await runCoverBackfill({ store, mode: "apply" });
      const second = await runCoverBackfill({ store, mode: "apply" });

      // Then
      expect(first.counts.writes).toBe(1);
      expect(second.counts.writes).toBe(0);
      expect((await store.loadVehicle("historical")).images.every((image) => image.origin === "CARPAN2")).toBe(true);
    });
  });
}
