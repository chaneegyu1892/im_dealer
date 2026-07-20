import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import type { PrismaClient, VehicleImage } from "@prisma/client";
import {
  deployDisposableSchemaFixture,
  prepareLocalPostgres,
  startLocalPostgres,
  stopLocalPostgres,
} from "./lib/carpan2-cover-harness";
import { installCleanupHandlers, OwnedCleanup } from "./vehicle-image-migration-cleanup";

const ROOT = resolve(import.meta.dirname, "..");
const PRISMA = join(ROOT, "node_modules/.bin/prisma");
const SCHEMA = join(ROOT, "prisma/schema.prisma");

class RevisionHarnessError extends Error { readonly name = "RevisionHarnessError"; }

function check(value: boolean, message: string): void {
  if (!value) throw new RevisionHarnessError(message);
}

async function createVehicle(db: PrismaClient, prefix: string, name: string) {
  return db.vehicle.create({
    data: {
      slug: `${prefix}-${name}`,
      name,
      brand: "TEST",
      category: "SUV",
      basePrice: 1,
      thumbnailUrl: "",
      imageUrls: [],
      tags: [],
    },
  });
}

async function createImage(
  db: PrismaClient,
  vehicleId: string,
  sourceKey: string,
  type: "MAIN" | "COVER" | "SPEC_OPTION",
  displayOrder = 0,
): Promise<VehicleImage> {
  return db.vehicleImage.create({
    data: {
      vehicleId,
      type,
      origin: "ADMIN",
      storageUrl: `https://test/${sourceKey}`,
      sourceKey,
      displayOrder,
    },
  });
}

async function verifyAdminMutations(db: PrismaClient, prefix: string): Promise<void> {
  const items = await import("../src/lib/vehicle-images/item-mutations");
  const ordering = await import("../src/lib/vehicle-images/ordering");
  const representative = await import("../src/lib/vehicle-images/representative");
  const subject = await createVehicle(db, prefix, "admin-sequence");
  const main = await createImage(db, subject.id, `${prefix}-main`, "MAIN");
  let cover = await createImage(db, subject.id, `${prefix}-cover`, "COVER", 1);
  const beforeBasicInfo = await db.vehicle.findUniqueOrThrow({ where: { id: subject.id } });
  const afterBasicInfo = await db.vehicle.update({ where: { id: subject.id }, data: { name: "admin-sequence-updated" } });
  check(afterBasicInfo.updatedAt > beforeBasicInfo.updatedAt, "BasicInfo update did not advance Vehicle.updatedAt");
  check(afterBasicInfo.imageRevision === 0, "BasicInfo update altered imageRevision");

  const hidden = await items.setVehicleImageVisibility(subject.id, main.id, {
    expectedUpdatedAt: main.updatedAt.toISOString(),
    expectedImageRevision: 0,
    isVisible: false,
  });
  check(hidden.imageRevision === 1, "visibility did not advance imageRevision to 1");

  const noOpVisibility = await items.setVehicleImageVisibility(subject.id, main.id, {
    expectedUpdatedAt: hidden.image.updatedAt.toISOString(),
    expectedImageRevision: hidden.imageRevision,
    isVisible: false,
  });
  check(noOpVisibility.imageRevision === 1, "visibility no-op bumped imageRevision");
  const staleVisibility = await items.setVehicleImageVisibility(subject.id, main.id, {
    expectedUpdatedAt: main.updatedAt.toISOString(),
    expectedImageRevision: hidden.imageRevision,
    isVisible: true,
  }).then(() => "fulfilled", (error: unknown) => error instanceof Error ? error.message : "unknown");
  check(staleVisibility === "STALE_IMAGE_STATE", "stale visibility was not rejected");
  check((await db.vehicle.findUniqueOrThrow({ where: { id: subject.id } })).imageRevision === 1, "rejected visibility bumped imageRevision");

  const edited = await items.editVehicleImage(subject.id, cover.id, {
    expectedUpdatedAt: cover.updatedAt.toISOString(),
    expectedImageRevision: hidden.imageRevision,
    title: "새 제목",
  });
  check(edited.imageRevision === 2, "edit did not advance imageRevision to 2");
  cover = edited.image;
  const reordered = await ordering.reorderVehicleImages(subject.id, {
    group: "PRIMARY",
    expectedImageRevision: edited.imageRevision,
    items: [
      { id: cover.id, expectedUpdatedAt: cover.updatedAt.toISOString() },
      { id: main.id, expectedUpdatedAt: hidden.image.updatedAt.toISOString() },
    ],
  });
  check(reordered.imageRevision === 3, "reorder did not advance imageRevision to 3");
  cover = reordered.images.find((image) => image.id === cover.id) ?? cover;
  const trashed = await items.trashVehicleImage(subject.id, cover.id, {
    expectedUpdatedAt: cover.updatedAt.toISOString(),
    expectedImageRevision: reordered.imageRevision,
  });
  const restored = await items.restoreVehicleImage(subject.id, cover.id, {
    expectedUpdatedAt: trashed.image.updatedAt.toISOString(),
    expectedImageRevision: trashed.imageRevision,
  });
  check(trashed.imageRevision === 4, "trash did not advance imageRevision to 4");
  check(restored.imageRevision === 5, "restore did not advance imageRevision to 5");
  const selected = await representative.setVehicleRepresentative(subject.id, cover.id, {
    expectedImageUpdatedAt: restored.image.updatedAt.toISOString(),
    expectedImageRevision: restored.imageRevision,
    expectedVehicleUpdatedAt: restored.vehicleUpdatedAt.toISOString(),
  });
  check(selected.vehicle.imageRevision === 6, "representative did not advance imageRevision to 6");
  const same = await representative.setVehicleRepresentative(subject.id, cover.id, {
    expectedImageUpdatedAt: restored.image.updatedAt.toISOString(),
    expectedImageRevision: selected.vehicle.imageRevision,
    expectedVehicleUpdatedAt: selected.vehicle.updatedAt.toISOString(),
  });
  check(same.vehicle.imageRevision === 6, "representative no-op bumped imageRevision");
  const staleImageRevision = await representative.setVehicleRepresentative(subject.id, cover.id, {
    expectedImageUpdatedAt: restored.image.updatedAt.toISOString(),
    expectedImageRevision: restored.imageRevision,
    expectedVehicleUpdatedAt: selected.vehicle.updatedAt.toISOString(),
  }).then(() => "fulfilled", (error: unknown) => error instanceof Error ? error.message : "unknown");
  check(staleImageRevision === "STALE_IMAGE_REVISION", "stale representative image revision was not rejected");
  const staleVehicle = await representative.setVehicleRepresentative(subject.id, cover.id, {
    expectedImageUpdatedAt: restored.image.updatedAt.toISOString(),
    expectedImageRevision: selected.vehicle.imageRevision,
    expectedVehicleUpdatedAt: restored.vehicleUpdatedAt.toISOString(),
  }).then(() => "fulfilled", (error: unknown) => error instanceof Error ? error.message : "unknown");
  check(staleVehicle === "STALE_VEHICLE_STATE", "stale representative vehicle state was not rejected");
  check((await db.vehicle.findUniqueOrThrow({ where: { id: subject.id } })).imageRevision === 6, "rejected representative bumped imageRevision");
}

async function verifyConcurrentRevisions(db: PrismaClient, prefix: string): Promise<void> {
  const items = await import("../src/lib/vehicle-images/item-mutations");
  const subject = await createVehicle(db, prefix, "concurrent");
  const first = await createImage(db, subject.id, `${prefix}-race-a`, "MAIN");
  const second = await createImage(db, subject.id, `${prefix}-race-b`, "COVER", 1);
  const outcomes = await Promise.allSettled([
    items.setVehicleImageVisibility(subject.id, first.id, { expectedUpdatedAt: first.updatedAt.toISOString(), expectedImageRevision: subject.imageRevision, isVisible: false }),
    items.setVehicleImageVisibility(subject.id, second.id, { expectedUpdatedAt: second.updatedAt.toISOString(), expectedImageRevision: subject.imageRevision, isVisible: false }),
  ]);
  const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected");
  check(fulfilled.length === 1, "concurrent stale snapshot produced multiple commits");
  check(rejected.length === 1, "concurrent stale snapshot was not rejected");
  const conflict = rejected[0];
  check(conflict?.status === "rejected" && conflict.reason instanceof Error && conflict.reason.message === "STALE_IMAGE_REVISION", "concurrent stale snapshot returned the wrong conflict");
  const committed = fulfilled[0];
  check(committed?.status === "fulfilled" && committed.value.imageRevision === 1, "concurrent committed revision mismatch");
  const readback = await db.vehicle.findUniqueOrThrow({ where: { id: subject.id }, select: { imageRevision: true } });
  check(readback.imageRevision === 1, "concurrent imageRevision readback mismatch");
}

async function verifyPurgeAndImporter(db: PrismaClient, prefix: string): Promise<void> {
  const cleanup = await import("../src/lib/vehicle-images/storage-cleanup");
  const { listVehicleImages } = await import("../src/lib/vehicle-images/item-mutations");
  const { createCarpan2ImagePersistence } = await import("../src/lib/carpan2-images/persistence");
  const purgeVehicle = await createVehicle(db, prefix, "purge");
  const retained = await createImage(db, purgeVehicle.id, `${prefix}-retained`, "MAIN");
  let removed = await createImage(db, purgeVehicle.id, `${prefix}-removed`, "SPEC_OPTION");
  removed = await db.vehicleImage.update({ where: { id: removed.id }, data: { deletedAt: new Date(), updatedAt: new Date("2099-03-02T00:00:00.000Z") } });
  await db.vehicleImage.update({ where: { id: retained.id }, data: { updatedAt: new Date("2099-03-01T00:00:00.000Z") } });
  const purged = await cleanup.purgeVehicleImage(purgeVehicle.id, removed.id, {
    expectedUpdatedAt: removed.updatedAt.toISOString(),
    expectedImageRevision: purgeVehicle.imageRevision,
  });
  const postMax = await db.vehicleImage.aggregate({ where: { vehicleId: purgeVehicle.id }, _max: { updatedAt: true } });
  check(postMax._max.updatedAt !== null && postMax._max.updatedAt < removed.updatedAt, "purge did not remove newest image timestamp");
  check(purged.imageRevision === 1, "purge did not advance imageRevision");
  check((await listVehicleImages(purgeVehicle.id)).imageRevision === 1, "GET imageRevision disagrees after purge");

  const importVehicle = await createVehicle(db, prefix, "importer");
  const persistence = createCarpan2ImagePersistence(db);
  const candidate = {
    vehicleExternalId: "external",
    type: "COVER" as const,
    title: "커버",
    sourceUrl: "https://carpan.example/cover.webp",
    sourceKey: `${prefix}-import-cover`,
    displayOrder: 0,
    metadata: { sourceField: "cover" },
  };
  const importedAsset = {
    vehicleId: importVehicle.id,
    existingImageId: null,
    candidate,
    storageUrl: "https://storage.example/cover.webp",
    listThumbnailUrl: "https://storage.example/list/cover.webp",
    listThumbnailStoragePath: "list-thumbnails/v1/cover.webp",
    listThumbnailReservation: null,
  };
  check(await persistence.applyMirroredCandidate(importedAsset) === "upserted", "importer write skipped");
  const importAfter = await db.vehicle.findUniqueOrThrow({ where: { id: importVehicle.id }, select: { imageRevision: true } });
  check(importAfter.imageRevision === 1, "importer did not advance imageRevision");
  check(await persistence.applyMirroredCandidate(importedAsset) === "skipped", "importer no-op was not skipped");
  const importNoOp = await db.vehicle.findUniqueOrThrow({ where: { id: importVehicle.id }, select: { imageRevision: true } });
  check(importNoOp.imageRevision === 1, "importer no-op bumped imageRevision");
}

async function verifyBackfillRevision(db: PrismaClient, prefix: string): Promise<void> {
  const { createPrismaBackfillStore } = await import("../src/lib/vehicle-images/backfill-prisma");
  const { runCoverBackfill } = await import("../src/lib/vehicle-images/backfill");
  const subject = await db.vehicle.create({
    data: {
      slug: `${prefix}-backfill`,
      name: "backfill",
      brand: "TEST",
      category: "SUV",
      basePrice: 1,
      thumbnailUrl: "https://legacy.example/cover.webp",
      imageUrls: ["https://legacy.example/cover.webp", "https://legacy.example/gallery.webp"],
      tags: [],
    },
  });
  const store = createPrismaBackfillStore(db);

  const first = await runCoverBackfill({ store, mode: "apply" });
  const firstReadback = await db.vehicle.findUniqueOrThrow({ where: { id: subject.id }, select: { imageRevision: true } });
  const second = await runCoverBackfill({ store, mode: "apply" });
  const secondReadback = await db.vehicle.findUniqueOrThrow({ where: { id: subject.id }, select: { imageRevision: true } });

  check(first.counts.writes === 3, "backfill first run write count mismatch");
  check(firstReadback.imageRevision === 1, "backfill write did not advance imageRevision once");
  check(second.counts.writes === 0, "backfill second run was not a no-op");
  check(secondReadback.imageRevision === 1, "backfill no-op bumped imageRevision");
}

async function main(): Promise<void> {
  const runtime = await prepareLocalPostgres();
  const owner = new OwnedCleanup();
  owner.register(() => stopLocalPostgres(ROOT, runtime));
  installCleanupHandlers(owner);
  try {
    startLocalPostgres(ROOT, runtime);
    process.env["DATABASE_URL"] = runtime.url;
    process.env["DIRECT_URL"] = runtime.url;
    deployDisposableSchemaFixture({ root: ROOT, prismaBinary: PRISMA, schemaPath: SCHEMA, runtime, environment: process.env });
    const { PrismaClient: Client } = await import("@prisma/client");
    const db = new Client();
    const prefix = `revision-${randomUUID()}`;
    try {
      await verifyAdminMutations(db, prefix);
      await verifyConcurrentRevisions(db, prefix);
      await verifyPurgeAndImporter(db, prefix);
      await verifyBackfillRevision(db, prefix);
    } finally {
      await db.$disconnect();
      await (await import("../src/lib/prisma")).prisma.$disconnect();
    }
    console.log("PASS imageRevision=admin_all,basic_info_isolated,no_op,rejected,purge,concurrent_no_raw_40001,importer,backfill,get_readback");
  } finally {
    owner.run();
  }
  console.log(`CLEANUP cluster=absent port=${runtime.port} temp=absent`);
}

main().catch((error: unknown) => {
  if (!(error instanceof Error)) throw error;
  console.error(error.message);
  process.exitCode = 1;
});
