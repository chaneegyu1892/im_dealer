import type { Prisma } from "@prisma/client";

const RETIRED_WRITE_MESSAGE =
  "Legacy image writes are disabled. Use scripts/import-carpan2-vehicle-images.ts --apply for managed VehicleImage imports.";

export const LEGACY_MIRROR_USAGE = `Usage: pnpm tsx scripts/mirror-vehicle-images.ts [options]

Audit-only options:
  --vehicle <id>  inspect one vehicle
  --host <host>   inspect URLs from one host
  --limit <count> limit vehicles with candidates
  --dry-run       accepted for backward compatibility
  --help          show this help

${RETIRED_WRITE_MESSAGE}`;

export type LegacyVehicleUpsertInput = {
  readonly slug: string;
  readonly name: string;
  readonly brand: string;
  readonly category: string;
  readonly vehicleCode: string;
  readonly externalId: string;
  readonly basePrice: number;
  readonly description: string | undefined;
  readonly detailedSpecs: Prisma.InputJsonValue;
};

type LegacyVehicleCreateData = LegacyVehicleUpsertInput & {
  readonly externalSource: "external";
  readonly thumbnailUrl: "";
  readonly imageUrls: string[];
  readonly isVisible: false;
};

type LegacyVehicleUpdateData = Omit<
  LegacyVehicleUpsertInput,
  "externalId"
> & {
  readonly externalSource: "external";
};

export type LegacyVehicleUpsertData = {
  readonly create: LegacyVehicleCreateData;
  readonly update: LegacyVehicleUpdateData;
};

export function buildLegacyVehicleUpsertData(
  input: LegacyVehicleUpsertInput,
): LegacyVehicleUpsertData {
  const shared = {
    slug: input.slug,
    name: input.name,
    brand: input.brand,
    category: input.category,
    vehicleCode: input.vehicleCode,
    externalSource: "external",
    basePrice: input.basePrice,
    description: input.description,
    detailedSpecs: input.detailedSpecs,
  } satisfies LegacyVehicleUpdateData;

  return {
    create: {
      ...shared,
      externalId: input.externalId,
      thumbnailUrl: "",
      imageUrls: [],
      isVisible: false,
    },
    update: shared,
  };
}

export type LegacyMirrorCliOptions = {
  readonly helpRequested: boolean;
  readonly host: string | null;
  readonly limit: number | null;
  readonly vehicleId: string | null;
};

export class LegacyMirrorArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyMirrorArgumentError";
  }
}

export class LegacyImageMutationDisabledError extends Error {
  constructor(flag: string) {
    super(`${flag} is no longer supported. ${RETIRED_WRITE_MESSAGE}`);
    this.name = "LegacyImageMutationDisabledError";
  }
}

export function parseLegacyMirrorArgs(
  argv: readonly string[],
): LegacyMirrorCliOptions {
  let helpRequested = false;
  let host: string | null = null;
  let limit: number | null = null;
  let vehicleId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      helpRequested = true;
    } else if (arg === "--dry-run") {
      continue;
    } else if (arg === "--apply" || arg === "--retry-failed") {
      throw new LegacyImageMutationDisabledError(arg);
    } else if (arg === "--host") {
      host = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--limit") {
      limit = parsePositiveInt(readArgValue(argv, index, arg), arg);
      index += 1;
    } else if (arg === "--vehicle") {
      vehicleId = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new LegacyMirrorArgumentError(`Unknown argument: ${arg}`);
    }
  }

  return { helpRequested, host, limit, vehicleId };
}

function readArgValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new LegacyMirrorArgumentError(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new LegacyMirrorArgumentError(`${flag} requires a positive integer`);
  }
  return parsed;
}

type LegacyMirrorVehicle = {
  readonly thumbnailUrl: string | null;
  readonly imageUrls: readonly string[];
};

type LegacyMirrorAuditOptions = {
  readonly host: string | null;
};

export type LegacyMirrorAudit = {
  readonly alreadyMirrored: number;
  readonly candidates: number;
  readonly ignored: number;
};

export function auditLegacyMirrorVehicle(
  vehicle: LegacyMirrorVehicle,
  options: LegacyMirrorAuditOptions,
): LegacyMirrorAudit {
  const urls = vehicle.thumbnailUrl
    ? [vehicle.thumbnailUrl, ...vehicle.imageUrls]
    : [...vehicle.imageUrls];
  let alreadyMirrored = 0;
  let candidates = 0;
  let ignored = 0;

  for (const url of urls) {
    if (isAlreadyMirrored(url)) {
      alreadyMirrored += 1;
    } else if (isLegacyMirrorCandidate(url, options.host)) {
      candidates += 1;
    } else {
      ignored += 1;
    }
  }

  return { alreadyMirrored, candidates, ignored };
}

function isAlreadyMirrored(url: string): boolean {
  return /\/storage\/v1\/object\/public\/vehicle-images\//.test(url);
}

function isLegacyMirrorCandidate(url: string, host: string | null): boolean {
  if (url === "" || url.startsWith("/") || url.startsWith("data:")) return false;
  try {
    const parsed = new URL(url);
    return host === null || parsed.hostname === host;
  } catch {
    return false;
  }
}
