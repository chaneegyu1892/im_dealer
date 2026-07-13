import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "../../../scripts/lib/database-target-guard";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst: mocks.findFirst } } }));

import { getVehicleImageE2EAdmin } from "./e2e-admin-session";

const databaseUrl = "postgresql://tester@127.0.0.1:55432/vehicle_image_e2e";

function environment(): NodeJS.ProcessEnv {
  const productionEndpoints = databaseEndpointFingerprints({
    runtimeUrl: "postgresql://production-runtime.invalid/production",
    directUrl: "postgresql://production-direct.invalid/production",
  });
  return {
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DIRECT_URL: databaseUrl,
    CARPAN2_E2E_TARGET: "test",
    CARPAN2_E2E_APPLY: "1",
    CARPAN2_E2E_EXPECTED_FINGERPRINT: databaseIdentityFingerprint({ runtimeUrl: databaseUrl, directUrl: databaseUrl }),
    PRODUCTION_DATABASE_FINGERPRINT: "a".repeat(64),
    PRODUCTION_DATABASE_RUNTIME_FINGERPRINT: productionEndpoints.runtime,
    PRODUCTION_DATABASE_DIRECT_FINGERPRINT: productionEndpoints.direct,
    VEHICLE_IMAGE_STORAGE_DRIVER: "filesystem-e2e",
    VEHICLE_IMAGE_STORAGE_ROOT: "/tmp/vehicle-image-e2e",
    VEHICLE_IMAGE_STORAGE_BASE_URL: "http://127.0.0.1:55433/storage",
    E2E_ADMIN_EMAIL: "admin@e2e.invalid",
    E2E_ADMIN_SESSION_TOKEN: "session-token-that-is-not-secret",
  };
}

describe("vehicle image E2E admin session", () => {
  beforeEach(() => mocks.findFirst.mockReset());

  it("resolves only the seeded active admin for the exact guarded token", async () => {
    const admin = { id: "admin", email: "admin@e2e.invalid", role: "admin", isActive: true };
    mocks.findFirst.mockResolvedValue(admin);
    await expect(getVehicleImageE2EAdmin("session-token-that-is-not-secret", environment())).resolves.toBe(admin);
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { email: "admin@e2e.invalid", isActive: true, role: { in: ["admin", "superadmin"] } } });
  });

  it("rejects a wrong token without querying the database", async () => {
    await expect(getVehicleImageE2EAdmin("wrong", environment())).resolves.toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
