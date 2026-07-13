import { describe, expect, it } from "vitest";
import { runCoverBackfill, type BackfillVehicle } from "./backfill";
import { MemoryBackfillStore } from "./backfill-test-store";

function vehicle(): BackfillVehicle {
  return {
    id: "vehicle-1",
    name: "Vehicle One",
    thumbnailUrl: "/custom.webp",
    thumbnailImageId: null,
    imageRevision: 0,
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
    imageUrls: ["/custom.webp", "/other.webp"],
    images: [],
  };
}

describe("COVER backfill image revision", () => {
  it("advances once for a changed apply and not for the second no-op", async () => {
    const store = new MemoryBackfillStore([vehicle()]);

    const first = await runCoverBackfill({ store, mode: "apply" });
    const firstRevision = (await store.loadVehicle("vehicle-1")).imageRevision;
    const second = await runCoverBackfill({ store, mode: "apply" });
    const secondRevision = (await store.loadVehicle("vehicle-1")).imageRevision;

    expect(first.counts.writes).toBe(3);
    expect(firstRevision).toBe(1);
    expect(second.counts).toMatchObject({ plannedCreates: 0, plannedVehicleUpdates: 0, writes: 0 });
    expect(secondRevision).toBe(1);
  });
});
