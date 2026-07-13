import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { installCleanupHandlers, OwnedCleanup } from "./vehicle-image-migration-cleanup";

const ROOT = resolve(import.meta.dirname, "..");
const PG_BIN = "/opt/homebrew/opt/postgresql@16/bin";
const PRISMA = join(ROOT, "node_modules/.bin/prisma");
type Runtime = { readonly work: string; readonly data: string; readonly port: number; readonly url: string };

class HarnessError extends Error { readonly name = "HarnessError"; }
function check(value: boolean, label: string): void { if (!value) throw new HarnessError(label); }
function checkOrderedIds(
  images: readonly { readonly id: string; readonly displayOrder: number }[],
  expectedIds: readonly string[],
  label: string,
): void {
  check(images.length === expectedIds.length, `${label} count`);
  check(images.every((image, index) => image.id === expectedIds[index] && image.displayOrder === index), `${label} order`);
}
function run(command: string, args: readonly string[], environment = process.env): string {
  const result = spawnSync(command, args, { cwd: ROOT, env: environment, encoding: "utf8", timeout: 90_000 });
  if (result.error || result.status !== 0) throw new HarnessError(`${command}: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}
async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) return reject(new HarnessError("port allocation"));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}
async function runtime(): Promise<Runtime> {
  check(existsSync(join(PG_BIN, "postgres")), "Homebrew PostgreSQL 16 missing");
  const work = mkdtempSync(join(tmpdir(), "vehicle-image-api-pg16-"));
  const port = await freePort();
  return { work, data: join(work, "data"), port, url: `postgresql://postgres@127.0.0.1:${port}/postgres?schema=public` };
}
function start(target: Runtime): void {
  run(join(PG_BIN, "initdb"), ["-D", target.data, "--username", "postgres", "--auth", "trust", "--no-locale", "--encoding", "UTF8"]);
  run(join(PG_BIN, "pg_ctl"), ["-D", target.data, "-l", join(target.work, "postgres.log"), "-o", `-h 127.0.0.1 -p ${target.port}`, "-w", "-t", "20", "start"]);
}
function stop(target: Runtime): void {
  const status = spawnSync(join(PG_BIN, "pg_ctl"), ["-D", target.data, "status"], { encoding: "utf8" });
  if (status.status === 0) run(join(PG_BIN, "pg_ctl"), ["-D", target.data, "-m", "immediate", "-w", "-t", "20", "stop"]);
  rmSync(target.work, { recursive: true, force: true });
  check(!existsSync(target.work), "temporary cluster remains");
}
async function rejectedCode(action: () => Promise<unknown>): Promise<string> {
  try { await action(); return "SUCCESS"; } catch (error) { return error instanceof Error ? error.message : "UNKNOWN"; }
}
function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let settle: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => { settle = resolve; });
  return { promise, resolve: () => { if (!settle) throw new HarnessError("deferred unresolved"); settle(); } };
}

async function verify(target: Runtime): Promise<void> {
  process.env["DATABASE_URL"] = target.url;
  process.env["DIRECT_URL"] = target.url;
  process.env["NEXT_PUBLIC_SUPABASE_URL"] = "http://127.0.0.1:9";
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "test-anon";
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = "test-service";
  run(PRISMA, ["db", "push", "--skip-generate", "--accept-data-loss"], process.env);
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const upload = await import("../src/lib/vehicle-images/upload");
  const cleanup = await import("../src/lib/vehicle-images/storage-cleanup");
  const items = await import("../src/lib/vehicle-images/item-mutations");
  const ordering = await import("../src/lib/vehicle-images/ordering");
  const representative = await import("../src/lib/vehicle-images/representative");
  const app = await import("../src/lib/prisma");
  const prefix = `pg16-${randomUUID()}`;
  const path = (name: string) => `${prefix}/${name}`;
  const vehicle = (name: string) => db.vehicle.create({ data: { slug: path(name), name, brand: "TEST", category: "SUV", basePrice: 1, thumbnailUrl: "", imageUrls: [], tags: [] } });
  try {
    await db.vehicleImageStorageCleanup.create({ data: { storagePath: path("ambiguous"), reason: "UPLOAD_ROLLBACK", status: "RESERVED", reservationToken: "owned" } });
    await upload.markUploadRollbackReady(path("ambiguous"), "owned");
    const ambiguous = await db.vehicleImageStorageCleanup.findUniqueOrThrow({ where: { storagePath: path("ambiguous") } });
    check(ambiguous.status === "READY" && ambiguous.reservationToken === null, "ambiguous upload not durable");
    check(await rejectedCode(() => upload.markUploadRollbackReady(path("missing"), "missing")) === "RESERVATION_CONFLICT", "missing token accepted");
    const missing = await db.vehicleImageStorageCleanup.findUniqueOrThrow({ where: { storagePath: path("missing") } });
    check(missing.status === "READY" && missing.reservationToken === null, "missing token not recreated READY");
    await db.vehicleImageStorageCleanup.create({ data: { storagePath: path("wrong"), reason: "UPLOAD_ROLLBACK", status: "RESERVED", reservationToken: "other" } });
    check(await rejectedCode(() => upload.markUploadRollbackReady(path("wrong"), "owned")) === "RESERVATION_CONFLICT", "wrong token accepted");
    check((await db.vehicleImageStorageCleanup.findUniqueOrThrow({ where: { storagePath: path("wrong") } })).reservationToken === "other", "wrong token overwritten");
    await db.vehicleImageStorageCleanup.deleteMany({ where: { storagePath: { startsWith: prefix } } });

    await db.vehicleImageStorageCleanup.createMany({ data: ["worker-a", "worker-b"].map((name) => ({ storagePath: path(name), reason: "IMAGE_PURGE" as const, status: "READY" as const })) });
    const seen: string[] = [];
    const release = deferred();
    const started = deferred();
    const deletion = async (storagePath: string) => { seen.push(storagePath); if (seen.length === 2) started.resolve(); await release.promise; };
    const workers = [cleanup.processStorageCleanupOnce({ deleteObject: deletion }), cleanup.processStorageCleanupOnce({ deleteObject: deletion })];
    await started.promise;
    check(new Set(seen).size === 2, "SKIP LOCKED workers claimed same row");
    release.resolve();
    check((await Promise.all(workers)).every((result) => result.kind === "deleted"), "workers did not complete");

    const now = new Date();
    await db.vehicleImageStorageCleanup.createMany({ data: [
      { storagePath: path("reserved"), reason: "UPLOAD_ROLLBACK", status: "RESERVED", reservationToken: "live", availableAt: new Date(now.getTime() - 600_000) },
      { storagePath: path("processing-live"), reason: "IMAGE_PURGE", status: "PROCESSING", leaseToken: "live", leaseExpiresAt: new Date(now.getTime() + 600_000) },
    ] });
    check((await cleanup.processStorageCleanupOnce({ storagePath: path("reserved"), now })).kind === "idle", "RESERVED claimed");
    const liveBefore = await db.vehicleImageStorageCleanup.findUniqueOrThrow({ where: { storagePath: path("processing-live") } });
    const liveEligibility = await app.prisma.$queryRawUnsafe<readonly { readonly eligible: boolean }[]>(
      'SELECT ("status" = \'PROCESSING\' AND "leaseExpiresAt" <= ($1::timestamptz AT TIME ZONE \'UTC\')) AS eligible FROM "VehicleImageStorageCleanup" WHERE "storagePath" = $2',
      now, path("processing-live"),
    );
    check(liveEligibility[0]?.eligible === false, `fixture unexpectedly eligible ${JSON.stringify(liveEligibility)}`);
    const liveResult = await cleanup.processStorageCleanupOnce({ storagePath: path("processing-live"), now });
    check(liveResult.kind === "idle", `live PROCESSING claimed status=${liveBefore.status} now=${now.toISOString()} lease=${liveBefore.leaseExpiresAt?.toISOString()} result=${JSON.stringify(liveResult)}`);
    await db.vehicleImageStorageCleanup.create({ data: { storagePath: path("expired"), reason: "IMAGE_PURGE", status: "PROCESSING", leaseToken: "old-lease", leaseExpiresAt: new Date(now.getTime() - 1) } });
    let oldLeaseCount = -1;
    await cleanup.processStorageCleanupOnce({ storagePath: path("expired"), now, deleteObject: async () => {
      oldLeaseCount = (await db.vehicleImageStorageCleanup.updateMany({ where: { storagePath: path("expired"), leaseToken: "old-lease" }, data: { status: "READY" } })).count;
    } });
    check(oldLeaseCount === 0, "expired old lease mutated reclaimed row");

    const ownerVehicle = await vehicle("owner");
    await db.vehicleImage.create({ data: { vehicleId: ownerVehicle.id, type: "MAIN", origin: "ADMIN", storageUrl: "https://test/owner", sourceKey: path("owner-key"), adminStoragePath: path("owner") } });
    await db.vehicleImageStorageCleanup.create({ data: { storagePath: path("owner"), reason: "UPLOAD_ROLLBACK", status: "READY", availableAt: now } });
    const ownerImage = await db.vehicleImage.findFirst({ where: { adminStoragePath: path("owner") } });
    const ownerJob = await db.vehicleImageStorageCleanup.findUnique({ where: { storagePath: path("owner") } });
    const ownerResult = await cleanup.processStorageCleanupOnce({ storagePath: path("owner"), now: new Date() });
    check(ownerResult.kind === "deferred", `active owner not deferred image=${ownerImage?.id} job=${ownerJob?.status}/${ownerJob?.availableAt.toISOString()} result=${JSON.stringify(ownerResult)}`);
    await db.vehicleImageStorageCleanup.createMany({ data: ["failure", "not-found"].map((name) => ({ storagePath: path(name), reason: "IMAGE_PURGE" as const, status: "READY" as const, availableAt: now })) });
    const failureNow = new Date();
    check((await cleanup.processStorageCleanupOnce({ storagePath: path("failure"), now: failureNow, deleteObject: async () => { throw new Error("storage down"); } })).kind === "deferred", "failure not deferred");
    const failure = await db.vehicleImageStorageCleanup.findUniqueOrThrow({ where: { storagePath: path("failure") } });
    check(failure.attempts === 1 && failure.lastError === "storage down" && failure.availableAt > failureNow, "failure backoff missing");
    check((await cleanup.processStorageCleanupOnce({ storagePath: path("not-found"), now: new Date(), deleteObject: async () => undefined })).kind === "deleted", "not-found not completed");

    const raceVehicle = await vehicle("state-race");
    const main = await db.vehicleImage.create({ data: { vehicleId: raceVehicle.id, type: "MAIN", origin: "ADMIN", storageUrl: "https://test/main", sourceKey: path("main") } });
    const cover = await db.vehicleImage.create({ data: { vehicleId: raceVehicle.id, type: "COVER", origin: "ADMIN", storageUrl: "https://test/cover", sourceKey: path("cover") } });
    await representative.setVehicleRepresentative(raceVehicle.id, main.id, { expectedImageUpdatedAt: main.updatedAt.toISOString(), expectedImageRevision: raceVehicle.imageRevision, expectedVehicleUpdatedAt: raceVehicle.updatedAt.toISOString() });
    const freshVehicle = await db.vehicle.findUniqueOrThrow({ where: { id: raceVehicle.id } });
    const stateRace = await Promise.allSettled([
      representative.setVehicleRepresentative(raceVehicle.id, cover.id, { expectedImageUpdatedAt: cover.updatedAt.toISOString(), expectedImageRevision: freshVehicle.imageRevision, expectedVehicleUpdatedAt: freshVehicle.updatedAt.toISOString() }),
      items.setVehicleImageVisibility(raceVehicle.id, cover.id, { expectedUpdatedAt: cover.updatedAt.toISOString(), expectedImageRevision: freshVehicle.imageRevision, isVisible: false }),
    ]);
    check(stateRace.filter((result) => result.status === "fulfilled").length === 1, "representative visibility race");
    const stateReadback = await db.vehicle.findUniqueOrThrow({ where: { id: raceVehicle.id }, include: { thumbnailImage: true } });
    check(stateReadback.thumbnailImage?.isVisible === true && stateReadback.thumbnailImage.deletedAt === null, "ineligible representative committed");
    const deleteCandidate = await db.vehicleImage.create({ data: { vehicleId: raceVehicle.id, type: "SPEC_SEAT", origin: "ADMIN", storageUrl: "https://test/delete", sourceKey: path("delete-candidate") } });
    const deleteVehicleVersion = await db.vehicle.findUniqueOrThrow({ where: { id: raceVehicle.id } });
    const deleteRace = await Promise.allSettled([
      representative.setVehicleRepresentative(raceVehicle.id, deleteCandidate.id, { expectedImageUpdatedAt: deleteCandidate.updatedAt.toISOString(), expectedImageRevision: deleteVehicleVersion.imageRevision, expectedVehicleUpdatedAt: deleteVehicleVersion.updatedAt.toISOString() }),
      items.trashVehicleImage(raceVehicle.id, deleteCandidate.id, { expectedUpdatedAt: deleteCandidate.updatedAt.toISOString(), expectedImageRevision: deleteVehicleVersion.imageRevision }),
    ]);
    check(deleteRace.filter((result) => result.status === "fulfilled").length === 1, "representative delete race");

    const moveOutcomes: string[] = [];
    for (let schedule = 0; schedule < 20; schedule += 1) {
      const moveVehicle = await vehicle(`move-race-${schedule}`);
      const moveMain = await db.vehicleImage.create({ data: { vehicleId: moveVehicle.id, type: "MAIN", origin: "ADMIN", storageUrl: "https://test/mm", sourceKey: path(`move-main-${schedule}`) } });
      const moveCover = await db.vehicleImage.create({ data: { vehicleId: moveVehicle.id, type: "COVER", origin: "ADMIN", storageUrl: "https://test/mc", sourceKey: path(`move-cover-${schedule}`), displayOrder: 1 } });
      const moveOption = await db.vehicleImage.create({ data: { vehicleId: moveVehicle.id, type: "SPEC_OPTION", origin: "ADMIN", storageUrl: "https://test/mo", sourceKey: path(`move-option-${schedule}`) } });
      const moveRace = await Promise.allSettled([
        items.editVehicleImage(moveVehicle.id, moveCover.id, { expectedUpdatedAt: moveCover.updatedAt.toISOString(), expectedImageRevision: moveVehicle.imageRevision, type: "SPEC_OPTION" }),
        ordering.reorderVehicleImages(moveVehicle.id, { group: "PRIMARY", expectedImageRevision: moveVehicle.imageRevision, items: [{ id: moveCover.id, expectedUpdatedAt: moveCover.updatedAt.toISOString() }, { id: moveMain.id, expectedUpdatedAt: moveMain.updatedAt.toISOString() }] }),
      ]);
      check(moveRace.filter((result) => result.status === "fulfilled").length === 1, `type move reorder race ${schedule}`);
      const editWon = moveRace[0]?.status === "fulfilled";
      moveOutcomes.push(editWon ? "E" : "R");
      const moved = await db.vehicleImage.findMany({ where: { vehicleId: moveVehicle.id, deletedAt: null }, orderBy: [{ displayOrder: "asc" }, { id: "asc" }] });
      const primary = moved.filter((image) => image.type === "MAIN" || image.type === "COVER");
      const options = moved.filter((image) => image.type === "SPEC_OPTION");
      checkOrderedIds(primary, editWon ? [moveMain.id] : [moveCover.id, moveMain.id], `PRIMARY ${schedule}`);
      checkOrderedIds(options, editWon ? [moveOption.id, moveCover.id] : [moveOption.id], `SPEC_OPTION ${schedule}`);
    }

    await db.$executeRawUnsafe(`CREATE FUNCTION "${prefix}_block"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."storagePath" LIKE '${prefix}/rollback%' THEN RAISE EXCEPTION 'forced enqueue rollback'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER "${prefix}_block_trigger" BEFORE INSERT OR UPDATE ON "VehicleImageStorageCleanup" FOR EACH ROW EXECUTE FUNCTION "${prefix}_block"()`);
    const purgeVehicle = await vehicle("purge-rollback");
    const purgeImage = await db.vehicleImage.create({ data: { vehicleId: purgeVehicle.id, type: "SPEC_OPTION", origin: "ADMIN", storageUrl: "https://test/pr", sourceKey: path("purge-rb"), adminStoragePath: path("rollback-purge"), deletedAt: new Date() } });
    check(await rejectedCode(() => cleanup.purgeVehicleImage(purgeVehicle.id, purgeImage.id, { expectedUpdatedAt: purgeImage.updatedAt.toISOString(), expectedImageRevision: purgeVehicle.imageRevision })) !== "SUCCESS", "purge trigger did not fail");
    check(await db.vehicleImage.count({ where: { id: purgeImage.id } }) === 1, "purge rollback lost image");
    const deleteRollback = await vehicle("delete-rollback");
    await db.vehicleImage.create({ data: { vehicleId: deleteRollback.id, type: "MAIN", origin: "ADMIN", storageUrl: "https://test/dr", sourceKey: path("delete-rb"), adminStoragePath: path("rollback-delete") } });
    check(await rejectedCode(() => cleanup.deleteVehicleWithStorageCleanup(deleteRollback.id)) !== "SUCCESS", "vehicle delete trigger did not fail");
    check(await db.vehicle.count({ where: { id: deleteRollback.id } }) === 1, "vehicle delete rollback lost vehicle");
    await db.$executeRawUnsafe(`DROP TRIGGER "${prefix}_block_trigger" ON "VehicleImageStorageCleanup"`);
    await db.$executeRawUnsafe(`DROP FUNCTION "${prefix}_block"()`);

    const purgeCommitVehicle = await vehicle("purge-commit");
    const purgeCommitImage = await db.vehicleImage.create({ data: { vehicleId: purgeCommitVehicle.id, type: "SPEC_OPTION", origin: "ADMIN", storageUrl: "https://test/pc", sourceKey: path("purge-commit-key"), adminStoragePath: path("purge-commit"), deletedAt: new Date() } });
    const purgeCommit = await cleanup.purgeVehicleImage(purgeCommitVehicle.id, purgeCommitImage.id, { expectedUpdatedAt: purgeCommitImage.updatedAt.toISOString(), expectedImageRevision: purgeCommitVehicle.imageRevision });
    check(purgeCommit.storageCleanup === "deferred" && await db.vehicleImage.count({ where: { id: purgeCommitImage.id } }) === 0, "purge commit missing");
    const deleteCommit = await vehicle("delete-commit");
    await db.vehicleImage.create({ data: { vehicleId: deleteCommit.id, type: "MAIN", origin: "ADMIN", storageUrl: "https://test/dc", sourceKey: path("delete-commit-key"), adminStoragePath: path("delete-commit") } });
    const deleted = await cleanup.deleteVehicleWithStorageCleanup(deleteCommit.id);
    check(deleted.cleanupJobs === 1 && await db.vehicle.count({ where: { id: deleteCommit.id } }) === 0, "vehicle delete commit missing");
    const editWins = moveOutcomes.filter((outcome) => outcome === "E").length;
    console.log(`PASS pg16=cas,skip_locked,leases,owner,backoff,not_found,atomicity,serializable_races schedules=${moveOutcomes.length} outcomes=${moveOutcomes.join("")} editWins=${editWins} reorderWins=${moveOutcomes.length - editWins}`);
  } finally {
    await db.vehicleImageStorageCleanup.deleteMany({ where: { storagePath: { startsWith: prefix } } });
    await db.vehicle.deleteMany({ where: { slug: { startsWith: prefix } } });
    await Promise.all([db.$disconnect(), app.prisma.$disconnect()]);
  }
}

async function main(): Promise<void> {
  const target = await runtime();
  const owner = new OwnedCleanup();
  owner.register(() => stop(target));
  installCleanupHandlers(owner);
  try { start(target); await verify(target); } finally { owner.run(); }
  console.log(`CLEANUP cluster=absent port=${target.port} temp=absent`);
}
main().catch((error: unknown) => { if (error instanceof Error) { console.error(error.message); process.exitCode = 1; } else throw error; });
