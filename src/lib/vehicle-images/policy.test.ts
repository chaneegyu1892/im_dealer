import { describe, expect, it } from "vitest";
import {
  VehicleImagePolicyError,
  assertImageVersion,
  assertMutationReady,
  assertRepresentativeEligible,
  assertVehicleImageRevision,
  assertVehicleVersion,
  classifyLegacyRepresentative,
  purgeImage,
  resolveDefaultRepresentative,
  restoreImage,
  setImageVisibility,
  softDeleteImage,
} from "./policy";

const image = (overrides: Partial<{
  id: string;
  type: "MAIN" | "COVER";
  origin: "CARPAN2" | "ADMIN";
  storageUrl: string;
  sourceUrl: string | null;
  isVisible: boolean;
  deletedAt: Date | null;
}> = {}) => ({
  id: "image-1",
  type: "MAIN" as const,
  origin: "CARPAN2" as const,
  storageUrl: "https://cdn/main.webp",
  sourceUrl: "https://source/main.webp",
  isVisible: true,
  deletedAt: null,
  ...overrides,
});

describe("vehicle image state policy", () => {
  it("distinguishes hiding from trash and preserves visibility on restore", () => {
    // Given
    const visible = image({ origin: "ADMIN" });

    // When
    const hidden = setImageVisibility(visible, false, null);
    const trashed = softDeleteImage(hidden, null, new Date("2026-07-12T00:00:00Z"));
    const restored = restoreImage(trashed);

    // Then
    expect(hidden).toMatchObject({ isVisible: false, deletedAt: null });
    expect(trashed.deletedAt).toEqual(new Date("2026-07-12T00:00:00Z"));
    expect(restored).toMatchObject({ isVisible: false, deletedAt: null });
  });

  it.each(["hide", "delete"])("rejects %s of the current representative with typed 409", (action) => {
    // Given
    const current = image();

    // When
    const mutate = () => action === "hide"
      ? setImageVisibility(current, false, current.id)
      : softDeleteImage(current, current.id, new Date());

    // Then
    expect(mutate).toThrowError(expect.objectContaining({
      code: "REPRESENTATIVE_IMAGE_MUTATION_FORBIDDEN",
      status: 409,
    }));
  });

  it("rejects hidden or deleted representative candidates", () => {
    // Given
    const candidates = [image({ isVisible: false }), image({ id: "deleted", deletedAt: new Date() })];

    // When / Then
    for (const candidate of candidates) {
      expect(() => assertRepresentativeEligible(candidate)).toThrow(VehicleImagePolicyError);
    }
  });

  it("requires migration for a non-empty unlinked legacy representative", () => {
    // Given / When
    const action = () => assertMutationReady({ thumbnailImageId: null, thumbnailUrl: " https://legacy/custom.webp " });

    // Then
    expect(action).toThrowError(expect.objectContaining({ code: "REPRESENTATIVE_MIGRATION_REQUIRED", status: 409 }));
  });

  it("selects eligible CARPAN2 COVER, then MAIN, then an existing URL fallback", () => {
    // Given
    const main = image();
    const cover = image({ id: "cover", type: "COVER", storageUrl: "https://cdn/cover.webp" });

    // When / Then
    expect(resolveDefaultRepresentative([main, cover], "https://legacy.webp")).toEqual({ kind: "image", imageId: "cover", url: "https://cdn/cover.webp" });
    expect(resolveDefaultRepresentative([main], "https://legacy.webp")).toEqual({ kind: "image", imageId: "image-1", url: "https://cdn/main.webp" });
    expect(resolveDefaultRepresentative([], " https://legacy.webp ")).toEqual({ kind: "existing", url: "https://legacy.webp" });
    expect(resolveDefaultRepresentative([], " ")).toEqual({ kind: "missing" });
  });

  it("selects deterministically and skips blank mirrored URLs", () => {
    // Given
    const coverB = image({ id: "cover-b", type: "COVER", storageUrl: "https://cdn/b.webp" });
    const coverA = image({ id: "cover-a", type: "COVER", storageUrl: " https://cdn/a.webp " });
    const blankCover = image({ id: "blank", type: "COVER", storageUrl: "   " });

    // When
    const forward = resolveDefaultRepresentative([coverB, coverA], "");
    const reverse = resolveDefaultRepresentative([coverA, coverB], "");

    // Then
    expect(forward).toEqual({ kind: "image", imageId: "cover-a", url: "https://cdn/a.webp" });
    expect(reverse).toEqual(forward);
    expect(resolveDefaultRepresentative([blankCover, image()], "")).toEqual({
      kind: "image",
      imageId: "image-1",
      url: "https://cdn/main.webp",
    });
  });

  it("allows only a trashed ADMIN image to be purged", () => {
    // Given
    const adminTrash = image({ origin: "ADMIN", deletedAt: new Date() });
    const carpanTrash = image({ origin: "CARPAN2", deletedAt: new Date() });

    // When / Then
    expect(purgeImage(adminTrash, null)).toEqual({ id: "image-1", purge: true });
    expect(() => purgeImage(carpanTrash, null)).toThrowError(expect.objectContaining({ code: "CARPAN2_IMAGE_PURGE_FORBIDDEN" }));
    expect(() => purgeImage(image({ origin: "ADMIN" }), null)).toThrowError(expect.objectContaining({ code: "IMAGE_NOT_TRASHED" }));
  });

  it("rejects illegal trash transitions with typed failures", () => {
    // Given
    const active = image({ origin: "ADMIN" });
    const trash = image({ origin: "ADMIN", deletedAt: new Date() });

    // When / Then
    expect(() => restoreImage(active)).toThrowError(expect.objectContaining({ code: "IMAGE_NOT_TRASHED" }));
    expect(() => softDeleteImage(trash, null, new Date())).toThrowError(expect.objectContaining({ code: "IMAGE_ALREADY_TRASHED" }));
    expect(() => setImageVisibility(trash, false, null)).toThrowError(expect.objectContaining({ code: "IMAGE_ALREADY_TRASHED" }));
  });

  it("classifies only exact trimmed CARPAN2 MAIN/COVER URL matches as managed", () => {
    // Given
    const rows = [
      image({ id: "admin", origin: "ADMIN", storageUrl: "https://custom.webp" }),
      image({ id: "cover", type: "COVER", storageUrl: "https://cdn/cover.webp", sourceUrl: "https://source/cover.webp" }),
    ];

    // When / Then
    expect(classifyLegacyRepresentative(" https://source/cover.webp ", rows)).toEqual({ kind: "carpan_managed", imageId: "cover" });
    expect(classifyLegacyRepresentative("https://custom.webp", rows)).toEqual({ kind: "custom", url: "https://custom.webp" });
    expect(classifyLegacyRepresentative("  ", rows)).toEqual({ kind: "blank" });
  });

  it("keeps non-primary CARPAN2 and partial URL matches custom", () => {
    // Given
    const spec = {
      ...image({ storageUrl: "https://cdn/spec.webp", sourceUrl: "https://source/spec.webp" }),
      type: "SPEC_EXTERIOR" as const,
    };

    // When / Then
    expect(classifyLegacyRepresentative("https://cdn/spec.webp", [spec])).toEqual({ kind: "custom", url: "https://cdn/spec.webp" });
    expect(classifyLegacyRepresentative("https://source/main", [image()])).toEqual({ kind: "custom", url: "https://source/main" });
  });

  it("rejects stale optimistic versions with a typed conflict", () => {
    // Given / When
    const action = () => assertImageVersion(new Date("2026-07-12T12:00:01Z"), "2026-07-12T12:00:00.000Z");

    // Then
    expect(action).toThrowError(expect.objectContaining({ code: "STALE_IMAGE_STATE", status: 409 }));
  });

  it("compares image and vehicle versions by instant and distinguishes stale vehicle state", () => {
    // Given
    const instant = new Date("2026-07-12T12:00:00.000Z");

    // When / Then
    expect(() => assertImageVersion(instant, "2026-07-12T21:00:00.000+09:00")).not.toThrow();
    expect(() => assertVehicleVersion(instant, "2026-07-12T12:00:01.000Z")).toThrowError(expect.objectContaining({
      code: "STALE_VEHICLE_STATE",
      status: 409,
    }));
  });

  it("rejects a stale parent image revision with typed 409", () => {
    expect(() => assertVehicleImageRevision(8, 7)).toThrowError(expect.objectContaining({
      code: "STALE_IMAGE_REVISION",
      status: 409,
    }));
    expect(() => assertVehicleImageRevision(8, 8)).not.toThrow();
  });
});
