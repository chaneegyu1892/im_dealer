import { describe, expect, it } from "vitest";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "../../../scripts/lib/database-target-guard";
import { assertVehicleImageE2ERuntime, VehicleImageE2EGuardError } from "./e2e-runtime";

const URLS = {
  runtimeUrl: "postgresql://tester@127.0.0.1:55432/vehicle_image_e2e",
  directUrl: "postgresql://tester@127.0.0.1:55432/vehicle_image_e2e",
} as const;

function validEnvironment(): NodeJS.ProcessEnv {
  const fingerprint = databaseIdentityFingerprint(URLS);
  const productionEndpoints = databaseEndpointFingerprints({
    runtimeUrl: "postgresql://production-runtime.invalid/production",
    directUrl: "postgresql://production-direct.invalid/production",
  });
  return {
    NODE_ENV: "test",
    DATABASE_URL: URLS.runtimeUrl,
    DIRECT_URL: URLS.directUrl,
    CARPAN2_E2E_TARGET: "test",
    CARPAN2_E2E_APPLY: "1",
    CARPAN2_E2E_EXPECTED_FINGERPRINT: fingerprint,
    PRODUCTION_DATABASE_FINGERPRINT: "a".repeat(64),
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
    VEHICLE_IMAGE_STORAGE_DRIVER: "filesystem-e2e",
    VEHICLE_IMAGE_STORAGE_ROOT: "/tmp/vehicle-image-e2e",
    VEHICLE_IMAGE_STORAGE_BASE_URL: "http://127.0.0.1:55433/storage",
  };
}

describe("vehicle image E2E runtime guard", () => {
  it("accepts a fingerprinted loopback database and storage runtime", () => {
    expect(assertVehicleImageE2ERuntime(validEnvironment()).database.runtime.host).toBe("127.0.0.1");
  });

  it.each([
    ["missing production fingerprint", { PRODUCTION_DATABASE_FINGERPRINT: undefined }],
    ["non-loopback database", { DATABASE_URL: "postgresql://tester@example.com:5432/e2e" }],
    ["mismatched database URLs", { DIRECT_URL: "postgresql://tester@127.0.0.1:55432/other" }],
    ["non-loopback storage", { VEHICLE_IMAGE_STORAGE_BASE_URL: "https://cdn.example/storage" }],
    ["production identity", { PRODUCTION_DATABASE_FINGERPRINT: databaseIdentityFingerprint(URLS) }],
    ["missing production runtime fingerprint", { PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: undefined }],
    ["missing production direct fingerprint", { PRODUCTION_DATABASE_DIRECT_FINGERPRINT: undefined }],
    ["production runtime endpoint", { PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: databaseEndpointFingerprints(URLS).runtime }],
    ["production direct endpoint", { PRODUCTION_DATABASE_DIRECT_FINGERPRINT: databaseEndpointFingerprints(URLS).direct }],
  ])("rejects %s", (_label, overrides) => {
    const environment = { ...validEnvironment(), ...overrides };
    expect(() => assertVehicleImageE2ERuntime(environment)).toThrow(VehicleImageE2EGuardError);
  });
});
