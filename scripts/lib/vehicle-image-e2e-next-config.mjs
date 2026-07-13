import { createHash } from "node:crypto";

const DEFAULT_IMAGES = { dangerouslyAllowLocalIP: false, remotePatterns: [] };

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`vehicle image E2E config requires ${name}`);
  return value;
}

function endpoint(raw) {
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("E2E database must use PostgreSQL");
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(database)) throw new Error("E2E database name is invalid");
  return { host: url.hostname.toLowerCase(), port: url.port === "" ? 5432 : Number(url.port), database };
}

function loopback(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requiredFingerprint(environment, name) {
  const value = required(environment, name).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`vehicle image E2E config requires a valid ${name}`);
  return value;
}

function vehicleImageE2ENextImageConfig(environment) {
  if (environment.VEHICLE_IMAGE_STORAGE_DRIVER !== "filesystem-e2e") return DEFAULT_IMAGES;
  if (environment.VEHICLE_IMAGE_E2E_ALLOW_LOCAL_IP !== "guarded"
    || environment.CARPAN2_E2E_TARGET !== "test"
    || environment.CARPAN2_E2E_APPLY !== "1") throw new Error("unguarded filesystem E2E image config");
  const runtime = endpoint(required(environment, "DATABASE_URL"));
  const direct = endpoint(required(environment, "DIRECT_URL"));
  if (!loopback(runtime.host) || !loopback(direct.host) || JSON.stringify(runtime) !== JSON.stringify(direct)) {
    throw new Error("E2E database identities must be matching loopback endpoints");
  }
  const actual = fingerprint({ runtime, direct });
  const actualRuntime = fingerprint(runtime);
  const actualDirect = fingerprint(direct);
  const productionRuntime = requiredFingerprint(environment, "PRODUCTION_DATABASE_RUNTIME_FINGERPRINT");
  const productionDirect = requiredFingerprint(environment, "PRODUCTION_DATABASE_DIRECT_FINGERPRINT");
  if (actual !== requiredFingerprint(environment, "CARPAN2_E2E_EXPECTED_FINGERPRINT")
    || actual === requiredFingerprint(environment, "PRODUCTION_DATABASE_FINGERPRINT")
    || actualRuntime === productionRuntime
    || actualRuntime === productionDirect
    || actualDirect === productionDirect
    || actualDirect === productionRuntime) {
    throw new Error("E2E database fingerprint guard failed");
  }
  const storage = new URL(required(environment, "VEHICLE_IMAGE_STORAGE_BASE_URL"));
  if (storage.protocol !== "http:" || !loopback(storage.hostname) || storage.pathname !== "/storage") {
    throw new Error("E2E storage must be exact loopback HTTP storage root");
  }
  return {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [{ protocol: "http", hostname: storage.hostname, port: storage.port, pathname: "/storage/**" }],
  };
}

export function vehicleImageE2ENextConfig(environment) {
  const images = vehicleImageE2ENextImageConfig(environment);
  if (!images.dangerouslyAllowLocalIP) {
    if (environment.VEHICLE_IMAGE_E2E_DIST_DIR?.trim()) {
      throw new Error("E2E dist directory requires guarded filesystem runtime");
    }
    return { distDir: undefined, tsconfigPath: undefined, images };
  }
  const distDir = required(environment, "VEHICLE_IMAGE_E2E_DIST_DIR");
  if (!/^\.next-e2e-[A-Za-z0-9][A-Za-z0-9-]*$/.test(distDir)) {
    throw new Error("E2E dist directory must be a unique project-local .next-e2e path");
  }
  const runId = distDir.slice(".next-e2e-".length);
  const tsconfigPath = required(environment, "VEHICLE_IMAGE_E2E_TSCONFIG_PATH");
  if (tsconfigPath !== `.tsconfig-e2e-${runId}.json`) {
    throw new Error("E2E tsconfig must match the unique dist run id");
  }
  return { distDir, tsconfigPath, images };
}
