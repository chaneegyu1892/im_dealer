import { mkdtemp, readFile, rm } from "node:fs/promises";
import { Blob } from "node:buffer";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { databaseEndpointFingerprints, databaseIdentityFingerprint } from "../../../scripts/lib/database-target-guard";
import {
  deleteFilesystemVehicleImage,
  uploadFilesystemVehicleImage,
} from "./filesystem-e2e-storage";

const databaseUrl = "postgresql://tester@127.0.0.1:55432/vehicle_image_e2e";
let root = "";

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
    VEHICLE_IMAGE_STORAGE_ROOT: root,
    VEHICLE_IMAGE_STORAGE_BASE_URL: "http://127.0.0.1:55433/storage",
  };
}

describe("filesystem E2E vehicle image storage", () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vehicle-image-storage-test-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes and deletes an owned object below the guarded root", async () => {
    const url = await uploadFilesystemVehicleImage({
      path: "admin/vehicle/image.webp",
      file: new Blob(["image-bytes"], { type: "image/webp" }),
      environment: environment(),
    });
    expect(url).toBe("http://127.0.0.1:55433/storage/admin/vehicle/image.webp");
    expect(await readFile(join(root, "admin/vehicle/image.webp"), "utf8")).toBe("image-bytes");

    await deleteFilesystemVehicleImage("admin/vehicle/image.webp", environment());
    await expect(readFile(join(root, "admin/vehicle/image.webp"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects path traversal before touching storage", async () => {
    await expect(uploadFilesystemVehicleImage({
      path: "../escape.webp",
      file: new Blob(["bad"]),
      environment: environment(),
    })).rejects.toThrow("INVALID_E2E_STORAGE_PATH");
  });
});
