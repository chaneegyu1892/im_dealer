import { describe, expect, it } from "vitest";
import {
  auditLegacyMirrorVehicle,
  buildLegacyVehicleUpsertData,
  LegacyImageMutationDisabledError,
  parseLegacyMirrorArgs,
} from "./legacy-writer-policy";

const VEHICLE_INPUT = {
  slug: "external-brand-101",
  name: "외부 차량",
  brand: "외부 브랜드",
  category: "SUV",
  vehicleCode: "EXT_101",
  externalId: "101",
  basePrice: 42_000_000,
  description: "재임포트 설명",
  detailedSpecs: { source: "legacy" },
};

describe("legacy vehicle writer policy", () => {
  it("preserves an admin representative and revision during a general vehicle reimport", () => {
    // Given: an existing vehicle whose managed representative was selected by an administrator.
    const existingImageState = {
      thumbnailUrl: "/vehicle-images/admin-cover.webp",
      imageUrls: ["/vehicle-images/admin-cover.webp"],
      thumbnailImageId: "admin-cover",
      imageRevision: 17,
    };

    // When: the legacy importer prepares its existing-Vehicle update.
    const write = buildLegacyVehicleUpsertData(VEHICLE_INPUT);
    const updated = { ...existingImageState, ...write.update };

    // Then: none of the managed image projection fields change.
    expect(updated.thumbnailUrl).toBe(existingImageState.thumbnailUrl);
    expect(updated.imageUrls).toEqual(existingImageState.imageUrls);
    expect(updated.thumbnailImageId).toBe(existingImageState.thumbnailImageId);
    expect(updated.imageRevision).toBe(existingImageState.imageRevision);
  });

  it("initializes a new legacy-imported vehicle without unmanaged image projections", () => {
    // Given: external non-image vehicle data.
    // When: the legacy importer prepares a new Vehicle create.
    const write = buildLegacyVehicleUpsertData(VEHICLE_INPUT);

    // Then: managed image fields start in the empty revision-zero state supplied by Prisma defaults.
    expect(write.create.thumbnailUrl).toBe("");
    expect(write.create.imageUrls).toEqual([]);
    expect(Object.hasOwn(write.create, "thumbnailImageId")).toBe(false);
    expect(Object.hasOwn(write.create, "imageRevision")).toBe(false);
  });

  it("defaults the mirror CLI to an audit-only run", () => {
    // Given: a mirror invocation without options.
    // When: CLI options are parsed.
    const options = parseLegacyMirrorArgs([]);

    // Then: no apply capability is enabled.
    expect(options).toEqual({ helpRequested: false, host: null, limit: null, vehicleId: null });
  });

  it("rejects the retired unsafe mirror apply mode", () => {
    // Given: an operator explicitly requests the old write mode.
    // When: CLI options are parsed.
    const parse = () => parseLegacyMirrorArgs(["--apply"]);

    // Then: the operator is directed away from the unsafe path.
    expect(parse).toThrow(LegacyImageMutationDisabledError);
  });

  it("audits external URLs without mutating managed state", () => {
    // Given: a vehicle with an admin representative and legacy external gallery URLs.
    const vehicle = {
      thumbnailUrl: "/vehicle-images/admin-cover.webp",
      imageUrls: ["https://p.ca8.kr/gallery-a.webp", "https://p.ca8.kr/gallery-b.webp"],
      thumbnailImageId: "admin-cover",
      imageRevision: 23,
    };
    const before = structuredClone(vehicle);

    // When: the retired mirror flow audits the vehicle.
    const audit = auditLegacyMirrorVehicle(vehicle, { host: "p.ca8.kr" });

    // Then: candidates are reported and every managed field remains byte-for-byte unchanged.
    expect(audit).toEqual({ alreadyMirrored: 0, candidates: 2, ignored: 1 });
    expect(vehicle).toEqual(before);
  });
});
