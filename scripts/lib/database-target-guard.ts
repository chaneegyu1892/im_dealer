import { createHash } from "node:crypto";

export type DatabaseEndpointIdentity = {
  readonly host: string;
  readonly port: number;
  readonly database: string;
};

export type DatabaseIdentity = {
  readonly runtime: DatabaseEndpointIdentity;
  readonly direct: DatabaseEndpointIdentity;
};

export type DatabaseUrls = {
  readonly runtimeUrl: string;
  readonly directUrl: string;
};

export type DatabaseEndpointFingerprints = {
  readonly runtime: string;
  readonly direct: string;
};

export type DatabaseTargetEnvironment = {
  readonly target: string | undefined;
  readonly applyFlag: string | undefined;
  readonly expectedFingerprint: string | undefined;
  readonly productionFingerprint: string | undefined;
  readonly productionRuntimeFingerprint: string | undefined;
  readonly productionDirectFingerprint: string | undefined;
};

export type DatabaseTargetMode = "dry-run" | "development" | "test" | "staging" | "production";

type GuardRequest = {
  readonly action: "dry-run" | "apply";
  readonly confirmProduction: string | null;
  readonly environment: DatabaseTargetEnvironment;
  readonly actualFingerprint: string;
  readonly actualEndpointFingerprints: DatabaseEndpointFingerprints;
};

export class DatabaseTargetGuardError extends Error {
  readonly name = "DatabaseTargetGuardError";

  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

function parseEndpoint(rawUrl: string, label: string): DatabaseEndpointIdentity {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (error) {
    throw new DatabaseTargetGuardError("INVALID_DATABASE_URL", `${label} is not a valid database URL`, { cause: error });
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new DatabaseTargetGuardError("INVALID_DATABASE_PROTOCOL", `${label} must use postgres or postgresql`);
  }
  if (parsed.hostname === "") {
    throw new DatabaseTargetGuardError("INVALID_DATABASE_HOST", `${label} must include a host`);
  }
  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch (error) {
    throw new DatabaseTargetGuardError("INVALID_DATABASE_NAME", `${label} database name is malformed`, { cause: error });
  }
  if (database === ""
    || database === "."
    || database === ".."
    || /[\u0000-\u001f\u007f]/.test(database)
    || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(database)) {
    throw new DatabaseTargetGuardError("INVALID_DATABASE_NAME", `${label} must identify exactly one database`);
  }
  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port === "" ? 5432 : Number(parsed.port),
    database,
  };
}

export function databaseIdentity(urls: DatabaseUrls): DatabaseIdentity {
  return {
    runtime: parseEndpoint(urls.runtimeUrl, "DATABASE_URL"),
    direct: parseEndpoint(urls.directUrl, "DIRECT_URL"),
  };
}

export function databaseIdentityFingerprint(urls: DatabaseUrls): string {
  return createHash("sha256").update(JSON.stringify(databaseIdentity(urls))).digest("hex");
}

function endpointFingerprint(identity: DatabaseEndpointIdentity): string {
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export function databaseEndpointFingerprints(urls: DatabaseUrls): DatabaseEndpointFingerprints {
  const identity = databaseIdentity(urls);
  return {
    runtime: endpointFingerprint(identity.runtime),
    direct: endpointFingerprint(identity.direct),
  };
}

function requireFingerprint(value: string | undefined, name: string): string {
  if (value === undefined || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new DatabaseTargetGuardError("MISSING_DATABASE_FINGERPRINT", `${name} must be a SHA-256 fingerprint`);
  }
  return value.toLowerCase();
}

function parseTarget(target: string | undefined): Exclude<DatabaseTargetMode, "dry-run"> {
  if (target === "development" || target === "test" || target === "staging" || target === "production") return target;
  throw new DatabaseTargetGuardError("INVALID_DATABASE_TARGET", "CARPAN2_COVER_TARGET must be development, test, staging, or production");
}

export function assertDatabaseTarget(request: GuardRequest): DatabaseTargetMode {
  if (request.action === "dry-run") return "dry-run";
  const target = parseTarget(request.environment.target);
  const actual = requireFingerprint(request.actualFingerprint, "actual fingerprint");
  const expected = requireFingerprint(request.environment.expectedFingerprint, "CARPAN2_COVER_EXPECTED_FINGERPRINT");
  const production = requireFingerprint(request.environment.productionFingerprint, "PRODUCTION_DATABASE_FINGERPRINT");
  const actualEndpoints = {
    runtime: requireFingerprint(request.actualEndpointFingerprints.runtime, "actual runtime fingerprint"),
    direct: requireFingerprint(request.actualEndpointFingerprints.direct, "actual direct fingerprint"),
  };
  const productionEndpoints = {
    runtime: requireFingerprint(
      request.environment.productionRuntimeFingerprint,
      "PRODUCTION_DATABASE_RUNTIME_FINGERPRINT",
    ),
    direct: requireFingerprint(
      request.environment.productionDirectFingerprint,
      "PRODUCTION_DATABASE_DIRECT_FINGERPRINT",
    ),
  };
  if (actual !== expected) {
    throw new DatabaseTargetGuardError("DATABASE_FINGERPRINT_MISMATCH", "actual database identity and expected fingerprint mismatch");
  }
  if (target === "production") {
    if (request.confirmProduction !== "carpan2-cover-407") {
      throw new DatabaseTargetGuardError("PRODUCTION_CONFIRMATION_MISMATCH", "production confirmation mismatch");
    }
    if (request.environment.applyFlag !== "production-confirmed") {
      throw new DatabaseTargetGuardError("PRODUCTION_APPLY_FLAG_MISMATCH", "production apply flag mismatch");
    }
    if (actual !== production) {
      throw new DatabaseTargetGuardError("PRODUCTION_IDENTITY_MISMATCH", "production identity must equal PRODUCTION_DATABASE_FINGERPRINT");
    }
    if (actualEndpoints.runtime !== productionEndpoints.runtime) {
      throw new DatabaseTargetGuardError("PRODUCTION_RUNTIME_IDENTITY_MISMATCH", "production runtime endpoint fingerprint mismatch");
    }
    if (actualEndpoints.direct !== productionEndpoints.direct) {
      throw new DatabaseTargetGuardError("PRODUCTION_DIRECT_IDENTITY_MISMATCH", "production direct endpoint fingerprint mismatch");
    }
    return "production";
  }
  if (request.confirmProduction !== null) {
    throw new DatabaseTargetGuardError("FORBIDDEN_PRODUCTION_CONFIRMATION", "production confirmation is forbidden for a non-production target");
  }
  if (request.environment.applyFlag !== "1") {
    throw new DatabaseTargetGuardError("NONPRODUCTION_APPLY_FLAG_MISMATCH", "non-production apply requires CARPAN2_COVER_APPLY=1");
  }
  if (actual === production) {
    throw new DatabaseTargetGuardError("PRODUCTION_IDENTITY_DENIED", "non-production target identity matches production");
  }
  if (actualEndpoints.runtime === productionEndpoints.runtime
    || actualEndpoints.runtime === productionEndpoints.direct) {
    throw new DatabaseTargetGuardError("PRODUCTION_RUNTIME_ENDPOINT_DENIED", "non-production runtime endpoint matches a production database endpoint");
  }
  if (actualEndpoints.direct === productionEndpoints.direct
    || actualEndpoints.direct === productionEndpoints.runtime) {
    throw new DatabaseTargetGuardError("PRODUCTION_DIRECT_ENDPOINT_DENIED", "non-production direct endpoint matches a production database endpoint");
  }
  return target;
}
