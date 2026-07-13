import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  createPrismaBackfillStore,
  legacySourceKey,
  planVehicleBackfill,
  readBackfillProjection,
} from "../src/lib/vehicle-images/backfill";
import {
  HOMEBREW_PG16_BIN,
  assertFirstApplyReceipt,
  CoverBackfillHarnessReportSchema,
  deployDisposableSchemaFixture,
  prepareLocalPostgres,
  probeHarnessCommand,
  runHarnessCommand,
  startLocalPostgres,
  stopLocalPostgres,
  type CoverBackfillHarnessReport,
  type LocalPostgresRuntime,
} from "./lib/carpan2-cover-harness";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "./lib/database-target-guard";
import { verifyBackfillTargetGuard } from "./lib/carpan2-cover-target-guard-harness";
import { installCleanupHandlers, OwnedCleanup } from "./vehicle-image-migration-cleanup";

const ROOT = resolve(import.meta.dirname, "..");
const CLI = join(ROOT, "scripts/backfill-carpan2-cover-thumbnails.ts");

class HarnessError extends Error { readonly name = "HarnessError"; }

const cleanup = new OwnedCleanup();
installCleanupHandlers(cleanup);

function probe(command: string, args: readonly string[], environment: NodeJS.ProcessEnv = process.env) {
  return probeHarnessCommand(ROOT, command, args, environment);
}

function run(command: string, args: readonly string[], environment: NodeJS.ProcessEnv = process.env): string {
  return runHarnessCommand(ROOT, command, args, environment);
}

async function createVehicle(prisma: PrismaClient, input: {
  readonly id: string;
  readonly thumbnailUrl?: string;
  readonly thumbnailImageId?: string;
  readonly imageUrls?: readonly string[];
}): Promise<void> {
  await prisma.vehicle.create({
    data: {
      id: input.id,
      slug: `fixture-${input.id}`,
      name: `Fixture ${input.id}`,
      brand: "Fixture",
      category: "SUV",
      basePrice: 1,
      thumbnailUrl: input.thumbnailUrl ?? "",
      thumbnailImageId: input.thumbnailImageId,
      imageUrls: [...(input.imageUrls ?? [])],
      tags: [],
    },
  });
}

async function createCarpan2Image(prisma: PrismaClient, input: {
  readonly id: string;
  readonly vehicleId: string;
  readonly type: "MAIN" | "COVER";
  readonly visible?: boolean;
  readonly deletedAt?: Date;
  readonly storageUrl?: string;
  readonly displayOrder?: number;
}): Promise<void> {
  await prisma.vehicleImage.create({ data: {
    id: input.id,
    vehicleId: input.vehicleId,
    type: input.type,
    origin: "CARPAN2",
    storageUrl: input.storageUrl ?? `https://mirror.example/${input.id}.webp`,
    sourceUrl: `https://source.example/${input.id}.webp`,
    sourceKey: `${input.type}:${input.id}`,
    displayOrder: input.displayOrder ?? 0,
    isVisible: input.visible ?? true,
    deletedAt: input.deletedAt,
  } });
}

async function seedFixtures(prisma: PrismaClient): Promise<void> {
  await createVehicle(prisma, { id: "cover" });
  await createCarpan2Image(prisma, { id: "cover-main", vehicleId: "cover", type: "MAIN" });
  await createCarpan2Image(prisma, { id: "cover-cover", vehicleId: "cover", type: "COVER" });
  await createVehicle(prisma, { id: "hidden", imageUrls: ["https://source.example/hidden-cover.webp"] });
  await createCarpan2Image(prisma, { id: "hidden-cover", vehicleId: "hidden", type: "COVER", visible: false });
  await createCarpan2Image(prisma, { id: "hidden-main", vehicleId: "hidden", type: "MAIN" });
  await createVehicle(prisma, { id: "deleted", imageUrls: ["https://source.example/deleted-cover.webp"] });
  await createCarpan2Image(prisma, { id: "deleted-cover", vehicleId: "deleted", type: "COVER", deletedAt: new Date("2026-01-01") });
  await createCarpan2Image(prisma, { id: "deleted-main", vehicleId: "deleted", type: "MAIN" });
  await createVehicle(prisma, { id: "custom", thumbnailUrl: "/custom.webp", imageUrls: [" /custom.webp ", "/other.webp", "/other.webp"] });
  await createVehicle(prisma, { id: "admin", thumbnailUrl: "/admin.webp" });
  await prisma.vehicleImage.create({ data: { id: "admin-image", vehicleId: "admin", type: "MAIN", origin: "ADMIN", storageUrl: "/admin.webp", sourceUrl: null, sourceKey: "admin:owned", adminStoragePath: null } });
  await prisma.vehicle.update({ where: { id: "admin" }, data: { thumbnailImageId: "admin-image" } });
  await createCarpan2Image(prisma, { id: "admin-cover", vehicleId: "admin", type: "COVER" });
  await createVehicle(prisma, { id: "whitespace" });
  await createCarpan2Image(prisma, { id: "whitespace-cover", vehicleId: "whitespace", type: "COVER", storageUrl: " https://mirror.example/whitespace-cover.webp " });
  await createCarpan2Image(prisma, { id: "whitespace-main", vehicleId: "whitespace", type: "MAIN" });
  await createVehicle(prisma, { id: "malformed" });
  await createCarpan2Image(prisma, { id: "malformed-cover", vehicleId: "malformed", type: "COVER", storageUrl: "not-a-url" });
  await createCarpan2Image(prisma, { id: "malformed-main", vehicleId: "malformed", type: "MAIN" });
  await createVehicle(prisma, { id: "http" });
  await createCarpan2Image(prisma, { id: "http-cover", vehicleId: "http", type: "COVER", storageUrl: "http://mirror.example/http-cover.webp" });
  await createCarpan2Image(prisma, { id: "http-main", vehicleId: "http", type: "MAIN" });
  await createVehicle(prisma, { id: "historical", thumbnailUrl: "https://source.example/historical-main.webp", imageUrls: ["https://source.example/historical-main.webp", "https://source.example/historical-cover.webp"] });
  await createCarpan2Image(prisma, { id: "historical-main", vehicleId: "historical", type: "MAIN", displayOrder: 7 });
  await createCarpan2Image(prisma, { id: "historical-cover", vehicleId: "historical", type: "COVER", displayOrder: 3 });
}

function cliEnvironment(runtime: LocalPostgresRuntime): NodeJS.ProcessEnv {
  const actual = databaseIdentityFingerprint({ runtimeUrl: runtime.url, directUrl: runtime.url });
  const productionUrl = `postgresql://postgres@127.0.0.1:${runtime.port}/production-do-not-connect`;
  const productionUrls = { runtimeUrl: productionUrl, directUrl: productionUrl };
  const production = databaseIdentityFingerprint(productionUrls);
  const productionEndpoints = databaseEndpointFingerprints(productionUrls);
  return {
    ...process.env,
    DATABASE_URL: runtime.url,
    DIRECT_URL: runtime.url,
    CARPAN2_COVER_TARGET: "test",
    CARPAN2_COVER_APPLY: "1",
    CARPAN2_COVER_EXPECTED_FINGERPRINT: actual,
    PRODUCTION_DATABASE_FINGERPRINT: production,
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
  };
}

function executeCli(args: readonly string[], environment: NodeJS.ProcessEnv): CoverBackfillHarnessReport {
  const output = run(process.execPath, ["--import", "tsx", CLI, ...args], environment);
  return CoverBackfillHarnessReportSchema.parse(JSON.parse(output));
}

async function verifyRollback(prisma: PrismaClient): Promise<void> {
  await createVehicle(prisma, { id: "rollback", thumbnailUrl: "/rollback.webp" });
  await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_rollback_vehicle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = 'rollback' THEN RAISE EXCEPTION 'forced rollback'; END IF; RETURN NEW; END $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_rollback BEFORE UPDATE ON "Vehicle" FOR EACH ROW EXECUTE FUNCTION reject_rollback_vehicle()`);
  let rejected = false;
  try {
    await createPrismaBackfillStore(prisma).applyVehicle("rollback", planVehicleBackfill);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("forced rollback")) throw error;
    rejected = true;
  }
  if (!rejected) throw new HarnessError("forced transaction rollback was not rejected");
  if (await prisma.vehicleImage.count({ where: { vehicleId: "rollback" } }) !== 0) throw new HarnessError("rollback left a partial legacy image");
  await prisma.$executeRawUnsafe(`DROP TRIGGER reject_rollback ON "Vehicle"`);
  await prisma.$executeRawUnsafe(`DROP FUNCTION reject_rollback_vehicle()`);
  await prisma.vehicle.delete({ where: { id: "rollback" } });
}

async function selectedImageId(prisma: PrismaClient, vehicleId: string): Promise<string | null> {
  return (await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { thumbnailImageId: true } }))?.thumbnailImageId ?? null;
}

async function verifyAppliedFixtures(prisma: PrismaClient): Promise<void> {
  const expected = [
    ["cover", "cover-cover"],
    ["hidden", "hidden-main"],
    ["deleted", "deleted-main"],
    ["admin", "admin-image"],
    ["whitespace", "whitespace-main"],
    ["malformed", "malformed-main"],
    ["http", "http-main"],
    ["historical", "historical-cover"],
  ] as const;
  for (const [vehicleId, imageId] of expected) {
    if (await selectedImageId(prisma, vehicleId) !== imageId) {
      throw new HarnessError(`unexpected representative: ${vehicleId}/${imageId}`);
    }
  }
  const custom = await prisma.vehicle.findUnique({ where: { id: "custom" }, include: { thumbnailImage: true, images: { orderBy: { displayOrder: "asc" } } } });
  if (custom?.thumbnailImage?.sourceKey !== legacySourceKey("/custom.webp")) throw new HarnessError("legacy representative key mismatch");
  if (JSON.stringify(custom.imageUrls) !== JSON.stringify([" /custom.webp ", "/other.webp", "/other.webp"])) throw new HarnessError("legacy imageUrls changed");
  if (custom.images.filter((image) => image.storageUrl === "/custom.webp").length !== 1) throw new HarnessError("legacy thumbnail duplicate was not reused");
  if (JSON.stringify(custom.images.map((image) => image.displayOrder)) !== JSON.stringify([0, 1])) throw new HarnessError("legacy display order was not normalized");
  const historical = await prisma.vehicle.findUnique({ where: { id: "historical" }, include: { images: true } });
  if (!historical || historical.images.length !== 2 || historical.images.some((image) => image.origin !== "CARPAN2")) throw new HarnessError("historical CARPAN2 URLs were duplicated as ADMIN");
  const historicalOrder = Object.fromEntries(historical.images.map((image) => [image.id, image.displayOrder]));
  if (historicalOrder["historical-main"] !== 7 || historicalOrder["historical-cover"] !== 3) throw new HarnessError("historical CARPAN2 editorial order changed");
  if (JSON.stringify(historical.imageUrls) !== JSON.stringify(["https://source.example/historical-main.webp", "https://source.example/historical-cover.webp"])) throw new HarnessError("historical imageUrls changed");
  for (const vehicleId of ["hidden", "deleted"]) {
    if (await prisma.vehicleImage.count({ where: { vehicleId, origin: "ADMIN" } }) !== 0) throw new HarnessError(`${vehicleId} managed URL was revived as ADMIN`);
  }
}

async function verifyReadbackRejections(prisma: PrismaClient): Promise<void> {
  await prisma.vehicle.update({ where: { id: "hidden" }, data: { thumbnailImageId: "hidden-cover", thumbnailUrl: "https://mirror.example/hidden-cover.webp" } });
  await prisma.vehicle.update({ where: { id: "deleted" }, data: { thumbnailImageId: "deleted-cover", thumbnailUrl: "https://mirror.example/deleted-cover.webp" } });
  await createVehicle(prisma, { id: "foreign-owner" });
  await prisma.vehicleImage.create({ data: { id: "foreign-image", vehicleId: "foreign-owner", type: "MAIN", origin: "ADMIN", storageUrl: "/foreign.webp", sourceUrl: null, sourceKey: "admin:foreign" } });
  await createVehicle(prisma, { id: "cross-owner" });
  await prisma.vehicle.update({ where: { id: "cross-owner" }, data: { thumbnailImageId: "foreign-image", thumbnailUrl: "/foreign.webp" } });
  const readback = await readBackfillProjection(prisma);
  const invalidIds = readback.samples.map((sample) => sample.id).sort();
  if (readback.migrationRequired !== 3 || JSON.stringify(invalidIds) !== JSON.stringify(["cross-owner", "deleted", "hidden"])) {
    throw new HarnessError(`readback failed to reject ownership/state fixtures: ${invalidIds.join(",")}`);
  }
  await prisma.vehicle.update({ where: { id: "hidden" }, data: { thumbnailImageId: "hidden-main", thumbnailUrl: "https://mirror.example/hidden-main.webp" } });
  await prisma.vehicle.update({ where: { id: "deleted" }, data: { thumbnailImageId: "deleted-main", thumbnailUrl: "https://mirror.example/deleted-main.webp" } });
  await prisma.vehicle.update({ where: { id: "cross-owner" }, data: { thumbnailImageId: null, thumbnailUrl: "" } });
  await prisma.vehicle.delete({ where: { id: "cross-owner" } });
  await prisma.vehicle.delete({ where: { id: "foreign-owner" } });
}

async function verifyCliReadbackFailure(prisma: PrismaClient, environment: NodeJS.ProcessEnv): Promise<void> {
  await createVehicle(prisma, { id: "readback-fail", thumbnailUrl: "/hidden-admin.webp" });
  await prisma.vehicleImage.create({ data: { id: "hidden-admin", vehicleId: "readback-fail", type: "MAIN", origin: "ADMIN", storageUrl: "/hidden-admin.webp", sourceUrl: null, sourceKey: "admin:hidden", isVisible: false } });
  await prisma.vehicle.update({ where: { id: "readback-fail" }, data: { thumbnailImageId: "hidden-admin" } });
  const failed = probe(process.execPath, ["--import", "tsx", CLI, "--apply"], environment);
  if (failed.status === 0 || !failed.stderr.includes("migration-required projections remain: 1")) {
    throw new HarnessError("apply did not fail on invalid post-apply readback");
  }
  await prisma.vehicle.delete({ where: { id: "readback-fail" } });
}

async function main(): Promise<void> {
  const runtime = await prepareLocalPostgres();
  cleanup.register(() => stopLocalPostgres(ROOT, runtime));
  startLocalPostgres(ROOT, runtime);
  const environment = cliEnvironment(runtime);
  verifyBackfillTargetGuard({ root: ROOT, cli: CLI, testUrl: runtime.url, productionUrl: `postgresql://postgres@127.0.0.1:${runtime.port}/production-do-not-connect`, environment });
  const prisma = new PrismaClient({ datasources: { db: { url: runtime.url } } });
  try {
    deployDisposableSchemaFixture({
      root: ROOT, prismaBinary: join(ROOT, "node_modules/.bin/prisma"),
      schemaPath: join(ROOT, "prisma/schema.prisma"), runtime,
      environment,
    });
    await seedFixtures(prisma);
    await verifyRollback(prisma);
    const first = executeCli(["--apply"], environment);
    assertFirstApplyReceipt({
      writes: first.counts.writes,
      invalidCandidates: first.counts.invalidCandidates,
      blockedLegacyUrls: first.counts.blockedLegacyUrls,
      migrationRequired: first.readback?.migrationRequired ?? -1,
    });
    await verifyAppliedFixtures(prisma);
    await verifyReadbackRejections(prisma);
    await verifyCliReadbackFailure(prisma, environment);
    const before = await prisma.vehicle.findMany({ select: { id: true, updatedAt: true, images: { select: { id: true, updatedAt: true }, orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
    const second = executeCli(["--apply"], environment);
    const dryRun = executeCli(["--dry-run"], environment);
    const after = await prisma.vehicle.findMany({ select: { id: true, updatedAt: true, images: { select: { id: true, updatedAt: true }, orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
    if (second.counts.writes !== 0 || second.counts.plannedCreates !== 0 || second.counts.plannedVehicleUpdates !== 0) throw new HarnessError("second apply was not idempotent");
    if (dryRun.counts.writes !== 0 || dryRun.counts.plannedCreates !== 0 || dryRun.counts.plannedVehicleUpdates !== 0) throw new HarnessError("post-apply dry-run was not clean");
    if (dryRun.counts.invalidCandidates !== 3) throw new HarnessError("invalid mirrored candidates were not reported");
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new HarnessError("second run churned updatedAt or rows");
    console.log(`PASS postgres=${run(join(HOMEBREW_PG16_BIN, "postgres"), ["--version"])} first_writes=${first.counts.writes} second_writes=0 dry_run_writes=0 readback=0 rollback=true`);
  } finally {
    await prisma.$disconnect();
    cleanup.run();
  }
  console.log(`CLEANUP port=${runtime.port} cluster=stopped tempdir=removed`);
}

main().catch((error: unknown) => { // no-excuse-ok: catch
  console.error(error instanceof Error ? error.message : "unknown COVER backfill harness error");
  process.exitCode = 1;
});
