import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { vehicleImageE2ENextConfig } from "./vehicle-image-e2e-next-config.mjs";

function environment() {
  const identity = {
    runtime: { host: "127.0.0.1", port: 55432, database: "vehicle_image_e2e" },
    direct: { host: "127.0.0.1", port: 55432, database: "vehicle_image_e2e" },
  };
  const productionRuntime = { host: "production-runtime.invalid", port: 5432, database: "production" };
  const productionDirect = { host: "production-direct.invalid", port: 5432, database: "production" };
  return {
    VEHICLE_IMAGE_STORAGE_DRIVER: "filesystem-e2e",
    VEHICLE_IMAGE_E2E_ALLOW_LOCAL_IP: "guarded",
    CARPAN2_E2E_TARGET: "test",
    CARPAN2_E2E_APPLY: "1",
    DATABASE_URL: "postgresql://tester@127.0.0.1:55432/vehicle_image_e2e",
    DIRECT_URL: "postgresql://tester@127.0.0.1:55432/vehicle_image_e2e",
    CARPAN2_E2E_EXPECTED_FINGERPRINT: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    PRODUCTION_DATABASE_FINGERPRINT: "b".repeat(64),
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: createHash("sha256").update(JSON.stringify(productionRuntime)).digest("hex"),
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: createHash("sha256").update(JSON.stringify(productionDirect)).digest("hex"),
    VEHICLE_IMAGE_STORAGE_BASE_URL: "http://127.0.0.1:55433/storage",
    VEHICLE_IMAGE_E2E_DIST_DIR: ".next-e2e-unit-run",
    VEHICLE_IMAGE_E2E_TSCONFIG_PATH: ".tsconfig-e2e-unit-run.json",
  };
}

describe("vehicle image E2E Next image config", () => {
  it("keeps local IP access disabled by default", () => {
    expect(vehicleImageE2ENextConfig({})).toEqual({
      distDir: undefined,
      tsconfigPath: undefined,
      images: { dangerouslyAllowLocalIP: false, remotePatterns: [] },
    });
  });

  it("enables only a canonical guarded loopback runtime", () => {
    expect(vehicleImageE2ENextConfig(environment())).toEqual({
      distDir: ".next-e2e-unit-run",
      tsconfigPath: ".tsconfig-e2e-unit-run.json",
      images: {
        dangerouslyAllowLocalIP: true,
        remotePatterns: [{ protocol: "http", hostname: "127.0.0.1", port: "55433", pathname: "/storage/**" }],
      },
    });
  });

  it.each([
    ["missing derived guard", { VEHICLE_IMAGE_E2E_ALLOW_LOCAL_IP: undefined }],
    ["non-loopback database", { DATABASE_URL: "postgresql://tester@db.example:5432/vehicle_image_e2e" }],
    ["mismatched database", { DIRECT_URL: "postgresql://tester@127.0.0.1:55432/other" }],
    ["production fingerprint", { PRODUCTION_DATABASE_FINGERPRINT: environment().CARPAN2_E2E_EXPECTED_FINGERPRINT }],
    ["missing production runtime fingerprint", { PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: undefined }],
    ["missing production direct fingerprint", { PRODUCTION_DATABASE_DIRECT_FINGERPRINT: undefined }],
    ["production runtime endpoint", { PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: createHash("sha256").update(JSON.stringify({ host: "127.0.0.1", port: 55432, database: "vehicle_image_e2e" })).digest("hex") }],
    ["production direct endpoint", { PRODUCTION_DATABASE_DIRECT_FINGERPRINT: createHash("sha256").update(JSON.stringify({ host: "127.0.0.1", port: 55432, database: "vehicle_image_e2e" })).digest("hex") }],
    ["non-loopback storage", { VEHICLE_IMAGE_STORAGE_BASE_URL: "http://cdn.example/storage" }],
    ["missing disposable dist", { VEHICLE_IMAGE_E2E_DIST_DIR: undefined }],
    ["shared default dist", { VEHICLE_IMAGE_E2E_DIST_DIR: ".next" }],
    ["escaping dist", { VEHICLE_IMAGE_E2E_DIST_DIR: "../.next-e2e-escape" }],
    ["missing disposable tsconfig", { VEHICLE_IMAGE_E2E_TSCONFIG_PATH: undefined }],
    ["mismatched disposable tsconfig", { VEHICLE_IMAGE_E2E_TSCONFIG_PATH: ".tsconfig-e2e-other.json" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => vehicleImageE2ENextConfig({ ...environment(), ...overrides })).toThrow();
  });
});
