import { describe, expect, it } from "vitest";
import type { AdminVehicleDetail, AdminVehicleImage } from "@/types/admin";
import {
  initialSnapshotState,
  publishLocalSnapshot,
  reconcileServerSnapshot,
  snapshotFromVehicle,
} from "./vehicle-image-snapshot";

const T0 = "2026-07-12T00:00:00.000Z";
const T1 = "2026-07-13T01:00:00.000Z";

function image(id: string): AdminVehicleImage {
  return {
    id, type: "COVER", origin: "CARPAN2", title: id, storageUrl: `/${id}.webp`,
    sourceUrl: null, sourceKey: id, displayOrder: 0, isVisible: true, deletedAt: null,
    createdAt: T0, updatedAt: T0, isRepresentative: true,
  };
}

function vehicle(overrides: Partial<AdminVehicleDetail> = {}): AdminVehicleDetail {
  const cover = image("cover-0");
  return {
    id: "vehicle-1", slug: "sorento", name: "쏘렌토", brand: "기아", category: "SUV",
    vehicleCode: "MQ4", basePrice: 40_000_000, thumbnailUrl: cover.storageUrl,
    imageUrls: [], surchargeRate: 0, isVisible: true, isPopular: false, isSpotlight: false,
    slidingDoorOverride: null, advancedSafetyOverride: null, displayOrder: 0, tags: [],
    description: null, createdAt: T0, updatedAt: T0, thumbnailImageId: cover.id,
    imageRevision: 0, images: [cover], trims: [], lineups: [], colors: [], ...overrides,
  };
}

describe("vehicle image snapshot revision ordering", () => {
  it("replaces the complete snapshot only when the same vehicle has a greater imageRevision", () => {
    const initial = initialSnapshotState(vehicle());
    const external = image("cover-3");

    const next = reconcileServerSnapshot(initial, vehicle({
      imageRevision: 3, updatedAt: T1, images: [external],
      thumbnailImageId: external.id, thumbnailUrl: external.storageUrl,
    }));

    expect(next.snapshot.images).toEqual([external]);
    expect(next.imageRevision).toBe(3);
  });

  it("preserves image data but advances the representative CAS version for equal imageRevision", () => {
    const initial = initialSnapshotState(vehicle());
    const misleading = image("same-revision-server-image");

    const next = reconcileServerSnapshot(initial, vehicle({
      imageRevision: 0, updatedAt: T1, images: [misleading],
      thumbnailImageId: misleading.id, thumbnailUrl: misleading.storageUrl,
    }));

    expect(next.snapshot.images).toEqual(initial.snapshot.images);
    expect(next.snapshot.thumbnailImageId).toBe(initial.snapshot.thumbnailImageId);
    expect(next.snapshot.updatedAt).toBe(T1);
    expect(next.imageRevision).toBe(0);
  });

  it("rejects equal or older image snapshots after a local revision is published", () => {
    const initial = initialSnapshotState(vehicle());
    const localVehicle = vehicle({ imageRevision: 2, updatedAt: T1, images: [image("local-2")] });
    const local = publishLocalSnapshot(initial, "vehicle-1", initial.epoch, snapshotFromVehicle(localVehicle));

    const equal = reconcileServerSnapshot(local, vehicle({ imageRevision: 2, images: [image("equal-2")] }));
    const older = reconcileServerSnapshot(equal, vehicle({ imageRevision: 1, images: [image("older-1")] }));

    expect(older.snapshot.images[0]?.id).toBe("local-2");
    expect(older.imageRevision).toBe(2);
  });

  it("publishes a newer vehicle CAS from an equal-revision reload without replacing images", () => {
    const initial = initialSnapshotState(vehicle());
    const reload = snapshotFromVehicle(vehicle({
      updatedAt: T1,
      images: [image("equal-reload-envelope")],
    }));

    const next = publishLocalSnapshot(initial, "vehicle-1", initial.epoch, reload);

    expect(next.snapshot.images).toEqual(initial.snapshot.images);
    expect(next.snapshot.updatedAt).toBe(T1);
    expect(next.imageRevision).toBe(0);
  });

  it("resets all snapshot versions when the vehicle id changes", () => {
    const initial = initialSnapshotState(vehicle({ imageRevision: 4 }));
    const other = vehicle({ id: "vehicle-2", imageRevision: 1, images: [image("other-cover")] });

    const next = reconcileServerSnapshot(initial, other);

    expect(next.vehicleId).toBe("vehicle-2");
    expect(next.imageRevision).toBe(1);
    expect(next.snapshot.images[0]?.id).toBe("other-cover");
  });
});
