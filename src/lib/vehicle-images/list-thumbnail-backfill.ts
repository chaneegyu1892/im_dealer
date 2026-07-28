export type VehicleListThumbnailBackfillImage = {
  readonly id: string;
  readonly storageUrl: string;
  readonly adminStoragePath: string | null;
};

import type { VehicleImageStorageReservation } from "./storage-reservation";

export type VehicleListThumbnailBackfillStats = {
  readonly eligible: number;
  readonly updated: number;
  readonly skippedUnowned: number;
  readonly skippedConcurrent: number;
  readonly failed: number;
};

type VehicleListThumbnailBackfillRequest = {
  readonly apply: boolean;
  readonly images: readonly VehicleListThumbnailBackfillImage[];
  readonly storage: {
    readonly download: (storagePath: string) => Promise<Uint8Array<ArrayBuffer>>;
    readonly upload: (
      storagePath: string,
      bytes: Uint8Array<ArrayBuffer>,
    ) => Promise<string>;
  };
  readonly cleanup: {
    readonly reserve: (storagePath: string) => Promise<VehicleImageStorageReservation>;
    readonly rollback: (reservation: VehicleImageStorageReservation) => Promise<void>;
  };
  readonly commit: (input: {
    readonly imageId: string;
    readonly expectedStorageUrl: string;
    readonly expectedAdminStoragePath: string | null;
    readonly listThumbnailUrl: string;
    readonly listThumbnailStoragePath: string;
    readonly reservation: VehicleImageStorageReservation;
  }) => Promise<boolean>;
  readonly concurrency: number;
};

type PlannedImage = {
  readonly image: VehicleListThumbnailBackfillImage;
  readonly sourcePath: string;
  readonly listThumbnailStoragePath: string;
};

export async function backfillVehicleListThumbnails(
  request: VehicleListThumbnailBackfillRequest,
): Promise<VehicleListThumbnailBackfillStats> {
  const planned: PlannedImage[] = [];
  let skippedUnowned = 0;
  for (const image of request.images) {
    const sourcePath = image.adminStoragePath
      ?? vehicleImageStoragePathFromPublicUrl(image.storageUrl);
    if (sourcePath === null) {
      skippedUnowned += 1;
      continue;
    }
    planned.push({
      image,
      sourcePath,
      listThumbnailStoragePath: vehicleListThumbnailPath(sourcePath),
    });
  }

  if (!request.apply) {
    return {
      eligible: planned.length,
      updated: 0,
      skippedUnowned,
      skippedConcurrent: 0,
      failed: 0,
    };
  }

  let updated = 0;
  let skippedConcurrent = 0;
  let failed = 0;
  await runWithConcurrency(planned, request.concurrency, async (plan) => {
    let reservation: VehicleImageStorageReservation | null = null;
    try {
      const source = await request.storage.download(plan.sourcePath);
      const thumbnail = await renderVehicleListThumbnail(source);
      reservation = await request.cleanup.reserve(plan.listThumbnailStoragePath);
      const listThumbnailUrl = await request.storage.upload(
        plan.listThumbnailStoragePath,
        thumbnail,
      );
      const saved = await request.commit({
        imageId: plan.image.id,
        expectedStorageUrl: plan.image.storageUrl,
        expectedAdminStoragePath: plan.image.adminStoragePath,
        listThumbnailUrl,
        listThumbnailStoragePath: plan.listThumbnailStoragePath,
        reservation,
      });
      reservation = null;
      if (saved) updated += 1;
      else skippedConcurrent += 1;
    } catch {
      if (reservation !== null) {
        await request.cleanup.rollback(reservation).catch(() => undefined);
      }
      failed += 1;
    }
  });

  return {
    eligible: planned.length,
    updated,
    skippedUnowned,
    skippedConcurrent,
    failed,
  };
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item === undefined) return;
      await worker(item);
    }
  }));
}
import {
  renderVehicleListThumbnail,
  vehicleImageStoragePathFromPublicUrl,
  vehicleListThumbnailPath,
} from "./list-thumbnail";
