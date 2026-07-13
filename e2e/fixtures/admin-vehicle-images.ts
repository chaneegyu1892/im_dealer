import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { test as base } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { assertVehicleImageE2ERuntime } from "../../src/lib/vehicle-images/e2e-runtime";
import { deleteVehicleWithStorageCleanup, processStorageCleanupOnce } from "../../src/lib/vehicle-images/storage-cleanup";
import {
  E2E_RATE_MATRIX,
  e2eRecommendationProfile,
  installNoLinkPrefetch,
} from "./vehicle-image-fixture-support";
import { seedForcedFailureVehicle } from "./vehicle-image-forced-fixture";
import { countOwnedVehicleImageAuditLogs, deleteOwnedVehicleImageAuditLogs, type CleanupOwnership, type VehicleImageCleanupReceipt } from "./vehicle-image-cleanup-support";

export type AdminVehicleImageFixture = {
  readonly prefix: string; readonly vehicleId: string; readonly slug: string;
  readonly coverId: string; readonly mainId: string; readonly hiddenId: string; readonly trashedId: string;
  readonly coverUrl: string; readonly mainUrl: string;
  readonly frozenSessionId: string; readonly frozenBytes: string;
};

type Fixtures = { readonly vehicleImages: AdminVehicleImageFixture };
const prisma = new PrismaClient();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XhNnAAAAAElFTkSuQmCC", "base64");

function frozenVehicle(vehicleId: string, slug: string, thumbnailUrl: string) {
  const scenario = { monthlyPayment: 500_000, depositAmount: 0, prepayAmount: 0, contractMonths: 60, annualMileage: 20_000, contractType: "반납형" };
  return {
    vehicleId, rank: 1, score: 1, scoringVersion: "overlap-v2", documentScore: 1,
    chargingAdjustment: 0, rankScore: 1, contributions: [],
    tieBreak: { modelYear: 2026, companyPriority: 1, isPopular: true, profitPriority: 1, slug },
    reason: "E2E 고정 추천", highlights: ["E2E"], estimatedMonthly: 500_000,
    vehicle: { name: "E2E 차량", brand: "E2E", category: "SUV", thumbnailUrl, imageUrls: [], defaultTrimName: "기본", defaultTrimPrice: 40_000_000, slug, popularConfigs: [] },
    scenarios: { conservative: scenario, standard: scenario, aggressive: scenario },
  };
}

export function vehicleImageFixtureFromPrefix(prefix: string): AdminVehicleImageFixture {
  const runtime = assertVehicleImageE2ERuntime(process.env);
  const vehicleId = `${prefix}-vehicle`;
  const slug = `${prefix}-car`;
  const coverId = `${prefix}-cover`;
  const mainId = `${prefix}-main`;
  const hiddenId = `${prefix}-hidden`;
  const trashedId = `${prefix}-trashed`;
  const frozenSessionId = `${prefix}-frozen`;
  const url = (name: string) => `${runtime.storageBaseUrl}/${prefix}/${name}.png`;
  const frozen = { version: "overlap-v2", vehicles: [frozenVehicle(vehicleId, slug, url("cover"))] } as const;
  return { prefix, vehicleId, slug, coverId, mainId, hiddenId, trashedId, coverUrl: url("cover"), mainUrl: url("main"), frozenSessionId, frozenBytes: JSON.stringify(frozen) };
}

export async function seedVehicleImageFixture(prefix: string, adminEmail = process.env.E2E_ADMIN_EMAIL): Promise<AdminVehicleImageFixture> {
  const runtime = assertVehicleImageE2ERuntime(process.env);
  const fixture = vehicleImageFixtureFromPrefix(prefix);
  const objectDir = join(runtime.storageRoot, prefix);
  await mkdir(objectDir, { recursive: true });
  await Promise.all(["cover", "main", "hidden", "trashed"].map((name) => writeFile(join(objectDir, `${name}.png`), PNG)));
  const url = (name: string) => `${runtime.storageBaseUrl}/${prefix}/${name}.png`;
  await prisma.user.create({ data: { id: `${prefix}-admin`, email: adminEmail, name: "E2E 관리자", role: "admin", isActive: true } });
  await prisma.vehicle.create({ data: {
    id: fixture.vehicleId, slug: fixture.slug, name: "E2E 차량", brand: "E2E", category: "SUV", basePrice: 40_000_000,
    thumbnailUrl: url("cover"), imageUrls: [url("cover"), url("main")], tags: ["E2E"],
    isVisible: true, isPopular: true, isSpotlight: true,
  } });
  const trimId = `${prefix}-trim`;
  const financeCompanyId = `${prefix}-finance`;
  await prisma.trim.create({ data: { id: trimId, vehicleId: fixture.vehicleId, name: "2026년형 기본", price: 40_000_000, engineType: "가솔린", isDefault: true, isVisible: true } });
  await prisma.financeCompany.create({ data: { id: financeCompanyId, name: `${prefix} 캐피탈`, code: `${prefix}-finance`, isActive: true } });
  await prisma.capitalRateSheet.create({ data: {
    id: `${prefix}-rate`, financeCompanyId, trimId, weekOf: new Date("2026-07-06T00:00:00.000Z"),
    minVehiclePrice: 40_000_000, maxVehiclePrice: 40_000_000,
    minBaseRates: E2E_RATE_MATRIX, minDepositRates: E2E_RATE_MATRIX, minPrepayRates: E2E_RATE_MATRIX,
    maxBaseRates: E2E_RATE_MATRIX, maxDepositRates: E2E_RATE_MATRIX, maxPrepayRates: E2E_RATE_MATRIX,
    minRateMatrix: E2E_RATE_MATRIX, maxRateMatrix: E2E_RATE_MATRIX,
    depositDiscountRate: -0.000523, prepayAdjustRate: 0.000073, isActive: true,
  } });
  await prisma.recommendationConfig.create({ data: {
    id: `${prefix}-recommend-config`, vehicleId: fixture.vehicleId,
    scoreMatrix: e2eRecommendationProfile(), highlights: ["E2E"], isActive: true,
  } });
  await prisma.rankSurchargeConfig.createMany({ data: [1, 2, 3, 4].map((rank) => ({ id: `${prefix}-rank-${rank}`, rank, rate: rank * 0.5 + 0.5 })) });
  await prisma.vehicleImage.createMany({ data: [
    { id: fixture.coverId, vehicleId: fixture.vehicleId, type: "COVER", origin: "CARPAN2", title: "디자인 표지", storageUrl: url("cover"), sourceUrl: "https://source.invalid/cover", sourceKey: `${prefix}:cover`, displayOrder: 0 },
    { id: fixture.mainId, vehicleId: fixture.vehicleId, type: "MAIN", origin: "CARPAN2", title: "메인 이미지", storageUrl: url("main"), sourceUrl: "https://source.invalid/main", sourceKey: `${prefix}:main`, displayOrder: 1 },
    { id: fixture.hiddenId, vehicleId: fixture.vehicleId, type: "SPEC_EXTERIOR", origin: "CARPAN2", title: "숨김 이미지", storageUrl: url("hidden"), sourceUrl: "https://source.invalid/hidden", sourceKey: `${prefix}:hidden`, isVisible: false },
    { id: fixture.trashedId, vehicleId: fixture.vehicleId, type: "SPEC_OPTION", origin: "CARPAN2", title: "휴지통 이미지", storageUrl: url("trashed"), sourceUrl: "https://source.invalid/trashed", sourceKey: `${prefix}:trashed`, deletedAt: new Date("2026-01-01T00:00:00.000Z") },
  ] });
  await prisma.vehicle.update({ where: { id: fixture.vehicleId }, data: { thumbnailImageId: fixture.coverId } });
  const frozen = { version: "overlap-v2", vehicles: [frozenVehicle(fixture.vehicleId, fixture.slug, fixture.coverUrl)] } as const;
  await prisma.recommendationLog.create({ data: {
    id: `${prefix}-recommendation`, sessionId: fixture.frozenSessionId, industry: "개인", purpose: "안정감", preferences: ["안정감"],
    budgetMin: 0, budgetMax: 0, paymentStyle: "표준형", annualMileage: 20_000, returnType: "미정",
    recommendedVehicleIds: [fixture.vehicleId], recommendedReason: {}, result: frozen,
  } });
  return fixture;
}

async function cleanup(
  fixture: AdminVehicleImageFixture | null,
  prefix: string,
  auditActorId = `${prefix}-admin`,
): Promise<CleanupOwnership> {
  const runtime = assertVehicleImageE2ERuntime(process.env);
  const vehicleId = fixture?.vehicleId ?? `${prefix}-vehicle`;
  const adminId = `${prefix}-admin`;
  const ownedImages = await prisma.vehicleImage.findMany({
    where: { vehicleId },
    select: { id: true, adminStoragePath: true },
  });
  const auditTargetIds = ownedImages.map(({ id }) => id);
  const storagePaths = ownedImages.flatMap(({ adminStoragePath }) => adminStoragePath ? [adminStoragePath] : []);
  await deleteOwnedVehicleImageAuditLogs(prisma, { auditActorId, auditTargetIds });
  await prisma.recommendationLog.deleteMany({ where: { sessionId: { startsWith: prefix } } });
  if (await prisma.vehicle.count({ where: { id: vehicleId } }) > 0) {
    await deleteVehicleWithStorageCleanup(vehicleId);
  }
  for (const storagePath of storagePaths) {
    const result = await processStorageCleanupOnce({ storagePath });
    if (result.kind !== "deleted") throw new Error(`owned storage cleanup did not complete: ${storagePath}`);
  }
  const cleanupRows = storagePaths.length === 0 ? 0 : await prisma.vehicleImageStorageCleanup.count({ where: { storagePath: { in: storagePaths } } });
  if (cleanupRows !== 0) throw new Error("owned storage cleanup outbox is not empty");
  await prisma.financeCompany.deleteMany({ where: { id: `${prefix}-finance` } });
  await prisma.rankSurchargeConfig.deleteMany({ where: { id: { startsWith: `${prefix}-rank-` } } });
  await prisma.user.deleteMany({ where: { id: adminId } });
  await rm(join(runtime.storageRoot, prefix), { recursive: true, force: true });
  await rm(join(runtime.storageRoot, "admin", vehicleId), { recursive: true, force: true });
  if (ownedImages.some(({ adminStoragePath }) => adminStoragePath && existsSync(join(runtime.storageRoot, adminStoragePath)))) throw new Error("owned storage object remains");
  const [vehicles, users, logs] = await Promise.all([
    prisma.vehicle.count({ where: { id: vehicleId } }), prisma.user.count({ where: { id: adminId } }),
    prisma.recommendationLog.count({ where: { sessionId: { startsWith: prefix } } }),
  ]);
  if (vehicles + users + logs !== 0) throw new Error("E2E database cleanup failed");
  return { auditTargetIds, storagePaths };
}

export async function verifyForcedFailureCleanup(
  parentPrefix: string,
  beforeFailure: (fixture: AdminVehicleImageFixture) => Promise<void>,
): Promise<VehicleImageCleanupReceipt> {
  const prefix = `${parentPrefix}-forced`;
  let fixture: AdminVehicleImageFixture | null = null;
  let storagePaths: readonly string[] = [];
  let auditTargetIds: readonly string[] = [];
  let forcedFailureObserved = false;
  const auditActorId = `${parentPrefix}-admin`;
  try {
    fixture = vehicleImageFixtureFromPrefix(prefix);
    await seedForcedFailureVehicle(fixture, PNG);
    await beforeFailure(fixture);
    const adminImages = await prisma.vehicleImage.findMany({
      where: { vehicleId: fixture.vehicleId, origin: "ADMIN", adminStoragePath: { not: null } },
      select: { adminStoragePath: true },
    });
    storagePaths = adminImages.flatMap(({ adminStoragePath }) => adminStoragePath ? [adminStoragePath] : []);
    if (storagePaths.length === 0) throw new Error("forced failure requires an ADMIN upload residue");
    auditTargetIds = await prisma.vehicleImage.findMany({
      where: { vehicleId: fixture.vehicleId, origin: "ADMIN" },
      select: { id: true },
    }).then((images) => images.map(({ id }) => id));
    const uploadAuditRows = await countOwnedVehicleImageAuditLogs(
      prisma,
      { auditActorId, auditTargetIds },
      "VEHICLE_IMAGE_CREATE",
    );
    if (uploadAuditRows !== 1) throw new Error(`forced upload audit ownership mismatch: ${uploadAuditRows}`);
    throw new Error("FORCED_MID_TEST_FAILURE");
  } catch (error: unknown) { // no-excuse-ok: catch -- verifies cleanup after the intentional failure sentinel only.
    if (!(error instanceof Error) || error.message !== "FORCED_MID_TEST_FAILURE") throw error;
    forcedFailureObserved = true;
  } finally {
    const ownership = await cleanup(fixture, prefix, auditActorId);
    storagePaths = ownership.storagePaths;
    auditTargetIds = ownership.auditTargetIds;
  }
  if (!forcedFailureObserved) throw new Error("forced failure was not observed");
  return { prefix, vehicleId: `${prefix}-vehicle`, adminId: `${prefix}-admin`, auditActorId, auditTargetIds, storagePaths };
}

export async function readVehicleImageCleanupState(receipt: VehicleImageCleanupReceipt) {
  const runtime = assertVehicleImageE2ERuntime(process.env);
  const [vehicles, images, users, logs, auditRows, outbox] = await Promise.all([
    prisma.vehicle.count({ where: { id: receipt.vehicleId } }),
    prisma.vehicleImage.count({ where: { vehicleId: receipt.vehicleId } }),
    prisma.user.count({ where: { id: receipt.adminId } }),
    prisma.recommendationLog.count({ where: { sessionId: { startsWith: receipt.prefix } } }),
    countOwnedVehicleImageAuditLogs(prisma, receipt),
    prisma.vehicleImageStorageCleanup.count({ where: { storagePath: { in: [...receipt.storagePaths] } } }),
  ]);
  return {
    databaseRows: vehicles + images + users + logs,
    auditRows,
    outboxRows: outbox,
    storageObjects: receipt.storagePaths.filter((storagePath) => existsSync(join(runtime.storageRoot, storagePath))).length,
    storageDirectoryExists: existsSync(join(runtime.storageRoot, "admin", receipt.vehicleId)),
  };
}

export const test = base.extend<Fixtures>({
  vehicleImages: async ({ page }, provide, testInfo) => {
    const prebuiltPrefix = process.env.VEHICLE_IMAGE_E2E_PREFIX?.trim();
    const prefix = prebuiltPrefix ?? `vi-e2e-${testInfo.workerIndex}-${randomUUID()}`;
    let fixture: AdminVehicleImageFixture | null = null;
    try {
      const seeded = prebuiltPrefix ? vehicleImageFixtureFromPrefix(prefix) : await seedVehicleImageFixture(prefix);
      fixture = { ...seeded, frozenBytes: await readRecommendationBytes(seeded.frozenSessionId) };
      await installNoLinkPrefetch(page);
      const login = await page.request.post("/api/e2e/vehicle-image-admin-login", { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
      if (!login.ok()) throw new Error(`E2E admin session failed: ${login.status()}`);
      await provide(fixture);
    } finally {
      await cleanup(fixture, prefix);
    }
  },
});

export { expect } from "@playwright/test";

export async function readRecommendationBytes(sessionId: string): Promise<string> {
  const log = await prisma.recommendationLog.findFirstOrThrow({ where: { sessionId }, select: { result: true } });
  return JSON.stringify(log.result);
}

export async function disconnectVehicleImageFixtureDatabase(): Promise<void> {
  await prisma.$disconnect();
}
