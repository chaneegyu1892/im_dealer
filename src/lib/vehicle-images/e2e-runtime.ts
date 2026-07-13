import { resolve } from "node:path";
import {
  databaseIdentity,
  databaseEndpointFingerprints,
  databaseIdentityFingerprint,
  type DatabaseIdentity,
} from "../../../scripts/lib/database-target-guard";

type VehicleImageE2ERuntime = {
  readonly database: DatabaseIdentity;
  readonly fingerprint: string;
  readonly storageRoot: string;
  readonly storageBaseUrl: string;
};

export class VehicleImageE2EGuardError extends Error {
  readonly name = "VehicleImageE2EGuardError";

  constructor(readonly code: string, message: string) {
    super(message);
  }
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new VehicleImageE2EGuardError("MISSING_E2E_CONFIGURATION", `${name} is required`);
  return value;
}

function fingerprint(environment: NodeJS.ProcessEnv, name: string): string {
  const value = required(environment, name).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new VehicleImageE2EGuardError("INVALID_E2E_FINGERPRINT", `${name} must be a SHA-256 fingerprint`);
  }
  return value;
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

export function assertVehicleImageE2ERuntime(environment: NodeJS.ProcessEnv): VehicleImageE2ERuntime {
  if (environment.CARPAN2_E2E_TARGET !== "test" || environment.CARPAN2_E2E_APPLY !== "1") {
    throw new VehicleImageE2EGuardError("INVALID_E2E_TARGET", "vehicle image E2E requires an explicit test target and apply flag");
  }
  if (environment.VEHICLE_IMAGE_STORAGE_DRIVER !== "filesystem-e2e") {
    throw new VehicleImageE2EGuardError("INVALID_E2E_STORAGE_DRIVER", "filesystem-e2e storage must be explicitly selected");
  }

  const urls = {
    runtimeUrl: required(environment, "DATABASE_URL"),
    directUrl: required(environment, "DIRECT_URL"),
  };
  const database = databaseIdentity(urls);
  if (!isLoopback(database.runtime.host) || !isLoopback(database.direct.host)) {
    throw new VehicleImageE2EGuardError("NON_LOOPBACK_DATABASE", "both database identities must be loopback");
  }
  if (JSON.stringify(database.runtime) !== JSON.stringify(database.direct)) {
    throw new VehicleImageE2EGuardError("DATABASE_IDENTITY_MISMATCH", "runtime and direct database identities must match");
  }

  const actual = databaseIdentityFingerprint(urls);
  const actualEndpoints = databaseEndpointFingerprints(urls);
  if (actual !== fingerprint(environment, "CARPAN2_E2E_EXPECTED_FINGERPRINT")) {
    throw new VehicleImageE2EGuardError("DATABASE_FINGERPRINT_MISMATCH", "database identity does not match the E2E fingerprint");
  }
  if (actual === fingerprint(environment, "PRODUCTION_DATABASE_FINGERPRINT")) {
    throw new VehicleImageE2EGuardError("PRODUCTION_DATABASE_DENIED", "E2E refuses the production database identity");
  }
  const productionRuntime = fingerprint(environment, "PRODUCTION_DATABASE_RUNTIME_FINGERPRINT");
  const productionDirect = fingerprint(environment, "PRODUCTION_DATABASE_DIRECT_FINGERPRINT");
  if (actualEndpoints.runtime === productionRuntime || actualEndpoints.runtime === productionDirect) {
    throw new VehicleImageE2EGuardError("PRODUCTION_RUNTIME_DATABASE_DENIED", "E2E refuses a production runtime database endpoint");
  }
  if (actualEndpoints.direct === productionDirect || actualEndpoints.direct === productionRuntime) {
    throw new VehicleImageE2EGuardError("PRODUCTION_DIRECT_DATABASE_DENIED", "E2E refuses a production direct database endpoint");
  }

  const storage = new URL(required(environment, "VEHICLE_IMAGE_STORAGE_BASE_URL"));
  if (storage.protocol !== "http:" || !isLoopback(storage.hostname) || storage.username || storage.password) {
    throw new VehicleImageE2EGuardError("NON_LOOPBACK_STORAGE", "filesystem E2E storage must use unauthenticated loopback HTTP");
  }
  const storageRoot = resolve(required(environment, "VEHICLE_IMAGE_STORAGE_ROOT"));
  if (storageRoot === "/") {
    throw new VehicleImageE2EGuardError("UNSAFE_STORAGE_ROOT", "filesystem E2E storage root cannot be the filesystem root");
  }
  return {
    database,
    fingerprint: actual,
    storageRoot,
    storageBaseUrl: storage.toString().replace(/\/$/, ""),
  };
}
