import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import {
  compileOverlapCatalog,
  verifyCatalogVehicleIdentities,
  type CompiledOverlapCatalogRow,
} from "../src/lib/recommend/overlap-catalog";
import {
  assessOperationalEligibility,
  type OperationalVehicleSnapshot,
  type SupportedRecommendationMileage,
} from "../src/lib/recommend/operational-eligibility";
import { parseOverlapProfile } from "../src/lib/recommend/overlap-profile";

const vehicleSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  category: true,
  isVisible: true,
  recConfigs: { select: { id: true, scoreMatrix: true, highlights: true, aiCaption: true, isActive: true, updatedAt: true } },
  trims: {
    select: {
      id: true,
      name: true,
      price: true,
      discountPrice: true,
      isDefault: true,
      isVisible: true,
      lineup: { select: { name: true, isVisible: true } },
      rateSheets: {
        select: {
          id: true,
          productType: true,
          isActive: true,
          minVehiclePrice: true,
          maxVehiclePrice: true,
          minRateMatrix: true,
          maxRateMatrix: true,
          depositDiscountRate: true,
          prepayAdjustRate: true,
          financeCompany: { select: { id: true, name: true, isActive: true, surchargeRate: true } },
        },
      },
    },
  },
} satisfies Prisma.VehicleSelect;

type BootstrapVehicle = Prisma.VehicleGetPayload<{ select: typeof vehicleSelect }>;
export type ProfileBootstrapAction = "create" | "migrate" | "preserve" | "reset";

export interface ProfileBootstrapChange {
  readonly vehicleId: string;
  readonly slug: string;
  readonly documentName: string;
  readonly action: ProfileBootstrapAction;
  readonly profile: CompiledOverlapCatalogRow["profile"];
}

export interface ProfileBootstrapReportRow {
  readonly slug: string;
  readonly documentName: string;
  readonly action: ProfileBootstrapAction;
  readonly coverage: Readonly<Record<"10000" | "20000" | "30000", string>>;
}

export interface ProfileBootstrapSnapshotRow {
  readonly vehicleId: string;
  readonly slug: string;
  readonly scoreMatrix: Prisma.JsonValue;
  readonly highlights: readonly string[];
  readonly aiCaption: string | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

function databaseIdentity(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get("schema") ?? "public";
  return `${url.protocol}//${url.hostname}:${url.port}/${url.pathname.replace(/^\//, "")}?schema=${schema}`;
}

export function getRecommendationDatabaseFingerprint(databaseUrl: string): string {
  return createHash("sha256").update(databaseIdentity(databaseUrl)).digest("hex");
}

export function decideProfileBootstrapAction(
  existingProfile: unknown | null,
  forceReset: boolean
): ProfileBootstrapAction {
  if (forceReset) return "reset";
  if (existingProfile === null) return "create";
  return parseOverlapProfile(existingProfile).kind === "valid" ? "preserve" : "migrate";
}

function toOperationalSnapshot(
  vehicle: BootstrapVehicle,
  catalogRow: CompiledOverlapCatalogRow
): OperationalVehicleSnapshot {
  return {
    vehicleId: vehicle.id,
    slug: vehicle.slug,
    brand: vehicle.brand,
    name: vehicle.name,
    category: vehicle.category,
    isVisible: vehicle.isVisible,
    config: { isActive: true, profile: catalogRow.profile },
    trims: vehicle.trims.map((trim) => ({
      id: trim.id,
      name: trim.name,
      price: trim.price,
      discountPrice: trim.discountPrice,
      isDefault: trim.isDefault,
      isVisible: trim.isVisible,
      lineup: trim.lineup,
      rateSheets: trim.rateSheets,
    })),
  };
}

export function planProfileBootstrapChanges(
  catalog: readonly CompiledOverlapCatalogRow[],
  vehicles: readonly BootstrapVehicle[],
  forceReset: boolean
): readonly ProfileBootstrapChange[] {
  verifyCatalogVehicleIdentities(catalog, vehicles);
  const vehicleBySlug = new Map(vehicles.map((vehicle) => [vehicle.slug, vehicle]));
  return catalog.map((row) => {
    const vehicle = vehicleBySlug.get(row.slug);
    if (!vehicle) throw new Error(`missing database slug: ${row.slug}`);
    const action = decideProfileBootstrapAction(vehicle.recConfigs?.scoreMatrix ?? null, forceReset);
    return { vehicleId: vehicle.id, slug: row.slug, documentName: row.documentName, action, profile: row.profile };
  });
}

export async function loadProfileBootstrapState(prisma: PrismaClient): Promise<{
  readonly catalog: readonly CompiledOverlapCatalogRow[];
  readonly vehicles: readonly BootstrapVehicle[];
}> {
  const catalog = compileOverlapCatalog();
  const vehicles = await prisma.vehicle.findMany({
    where: { slug: { in: catalog.map((row) => row.slug) } },
    select: vehicleSelect,
  });
  verifyCatalogVehicleIdentities(catalog, vehicles);
  return { catalog, vehicles };
}

export function buildProfileBootstrapReport(
  catalog: readonly CompiledOverlapCatalogRow[],
  vehicles: readonly BootstrapVehicle[],
  changes: readonly ProfileBootstrapChange[]
): readonly ProfileBootstrapReportRow[] {
  const vehicleBySlug = new Map(vehicles.map((vehicle) => [vehicle.slug, vehicle]));
  const actionBySlug = new Map(changes.map((change) => [change.slug, change.action]));
  const mileages: readonly SupportedRecommendationMileage[] = [10_000, 20_000, 30_000];
  return catalog.map((row) => {
    const vehicle = vehicleBySlug.get(row.slug);
    const action = actionBySlug.get(row.slug);
    if (!vehicle || !action) throw new Error(`incomplete bootstrap report: ${row.slug}`);
    const statuses = mileages.map((mileage) => assessOperationalEligibility(toOperationalSnapshot(vehicle, row), mileage).status);
    return {
      slug: row.slug,
      documentName: row.documentName,
      action,
      coverage: { "10000": statuses[0] ?? "invalid", "20000": statuses[1] ?? "invalid", "30000": statuses[2] ?? "invalid" },
    };
  });
}

export function buildProfileBootstrapSnapshot(vehicles: readonly BootstrapVehicle[]): readonly ProfileBootstrapSnapshotRow[] {
  return vehicles.flatMap((vehicle) => vehicle.recConfigs ? [{
    vehicleId: vehicle.id,
    slug: vehicle.slug,
    scoreMatrix: vehicle.recConfigs.scoreMatrix,
    highlights: vehicle.recConfigs.highlights,
    aiCaption: vehicle.recConfigs.aiCaption,
    isActive: vehicle.recConfigs.isActive,
    updatedAt: vehicle.recConfigs.updatedAt.toISOString(),
  }] : []);
}

export async function writeProfileBootstrapSnapshot(
  path: string,
  databaseFingerprint: string,
  vehicles: readonly BootstrapVehicle[]
): Promise<void> {
  const absolutePath = resolve(path);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify({
    version: "overlap-v2-pre-apply-snapshot",
    databaseFingerprint,
    configs: buildProfileBootstrapSnapshot(vehicles),
  }, null, 2)}\n`, "utf8");
}

export async function applyProfileBootstrapChanges(
  prisma: PrismaClient,
  changes: readonly ProfileBootstrapChange[]
): Promise<number> {
  const writable = changes.filter((change) => change.action !== "preserve");
  await prisma.$transaction(async (transaction) => {
    for (const change of writable) {
      if (change.action === "create") {
        await transaction.recommendationConfig.create({
          data: { vehicleId: change.vehicleId, scoreMatrix: change.profile, highlights: [], aiCaption: null, isActive: true, updatedBy: "overlap-v2-bootstrap" },
        });
      } else {
        await transaction.recommendationConfig.update({
          where: { vehicleId: change.vehicleId },
          data: { scoreMatrix: change.profile, isActive: true, updatedBy: "overlap-v2-bootstrap" },
        });
      }
    }
  });
  return writable.length;
}
