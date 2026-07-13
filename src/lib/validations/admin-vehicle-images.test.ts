import { describe, expect, it } from "vitest";
import {
  vehicleImageCreateSchema,
  vehicleImageDeleteSchema,
  vehicleImageEditSchema,
  vehicleImagePurgeSchema,
  vehicleImageReorderSchema,
  vehicleImageRepresentativeSchema,
  vehicleImageRestoreSchema,
  vehicleImageVisibilitySchema,
} from "./admin-vehicle-images";

const UPDATED_AT = "2026-07-12T12:00:00.000Z";

describe("admin vehicle image boundary schemas", () => {
  it("parses the exact multipart create payload when every field is present", () => {
    // Given
    const file = new File(["image"], "cover.webp", { type: "image/webp" });

    // When
    const result = vehicleImageCreateSchema.safeParse({
      file,
      title: "커버",
      type: "COVER",
      isVisible: "true",
    });

    // Then
    expect(result).toEqual({
      success: true,
      data: { file, title: "커버", type: "COVER", isVisible: true },
    });
  });

  it.each([
    ["missing file", { title: "커버", type: "COVER", isVisible: "true" }],
    ["missing title", { file: new File(["x"], "x.webp"), type: "COVER", isVisible: "true" }],
    ["missing type", { file: new File(["x"], "x.webp"), title: "커버", isVisible: "true" }],
    ["missing visibility", { file: new File(["x"], "x.webp"), title: "커버", type: "COVER" }],
    ["invalid type", { file: new File(["x"], "x.webp"), title: "커버", type: "OTHER", isVisible: "true" }],
    ["invalid visibility", { file: new File(["x"], "x.webp"), title: "커버", type: "COVER", isVisible: "1" }],
    ["unknown ownership field", { file: new File(["x"], "x.webp"), title: "커버", type: "COVER", isVisible: "true", origin: "ADMIN" }],
  ])("rejects malformed multipart create input: %s", (_label, input) => {
    // Given / When
    const result = vehicleImageCreateSchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });

  it("accepts each exact JSON mutation payload", () => {
    // Given
    const cases = [
      [vehicleImageEditSchema, { expectedUpdatedAt: UPDATED_AT, expectedImageRevision: 7, title: "새 제목" }],
      [vehicleImageEditSchema, { expectedUpdatedAt: UPDATED_AT, expectedImageRevision: 7, type: "MAIN" }],
      [vehicleImageVisibilitySchema, { expectedUpdatedAt: UPDATED_AT, expectedImageRevision: 7, isVisible: false }],
      [vehicleImageDeleteSchema, { expectedUpdatedAt: UPDATED_AT, expectedImageRevision: 7 }],
      [vehicleImageRestoreSchema, { expectedUpdatedAt: UPDATED_AT, expectedImageRevision: 7 }],
      [vehicleImagePurgeSchema, { expectedUpdatedAt: UPDATED_AT, expectedImageRevision: 7 }],
      [vehicleImageRepresentativeSchema, { expectedImageUpdatedAt: UPDATED_AT, expectedImageRevision: 7, expectedVehicleUpdatedAt: UPDATED_AT }],
      [vehicleImageReorderSchema, { group: "PRIMARY", expectedImageRevision: 7, items: [{ id: "image-1", expectedUpdatedAt: UPDATED_AT }] }],
    ] as const;

    // When
    const results = cases.map(([schema, input]) => schema.safeParse(input).success);

    // Then
    expect(results).toEqual(cases.map(() => true));
  });

  it.each([
    ["edit", vehicleImageEditSchema, { expectedUpdatedAt: UPDATED_AT, title: "새 제목" }],
    ["visibility", vehicleImageVisibilitySchema, { expectedUpdatedAt: UPDATED_AT, isVisible: false }],
    ["delete", vehicleImageDeleteSchema, { expectedUpdatedAt: UPDATED_AT }],
    ["restore", vehicleImageRestoreSchema, { expectedUpdatedAt: UPDATED_AT }],
    ["purge", vehicleImagePurgeSchema, { expectedUpdatedAt: UPDATED_AT }],
    ["reorder", vehicleImageReorderSchema, { group: "PRIMARY", items: [] }],
  ])("rejects %s without the parent image revision", (_label, schema, input) => {
    // Given / When
    const result = schema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([
    ["empty edit", vehicleImageEditSchema, { expectedUpdatedAt: UPDATED_AT }],
    ["bad edit version", vehicleImageEditSchema, { expectedUpdatedAt: "yesterday", title: "제목" }],
    ["visibility extra key", vehicleImageVisibilitySchema, { expectedUpdatedAt: UPDATED_AT, isVisible: true, id: "image-1" }],
    ["delete missing version", vehicleImageDeleteSchema, {}],
    ["restore extra key", vehicleImageRestoreSchema, { expectedUpdatedAt: UPDATED_AT, force: true }],
    ["purge malformed version", vehicleImagePurgeSchema, { expectedUpdatedAt: "invalid" }],
    ["representative missing vehicle version", vehicleImageRepresentativeSchema, { expectedImageUpdatedAt: UPDATED_AT }],
    ["representative missing image revision", vehicleImageRepresentativeSchema, { expectedImageUpdatedAt: UPDATED_AT, expectedVehicleUpdatedAt: UPDATED_AT }],
    ["reorder unknown group", vehicleImageReorderSchema, { group: "MAIN", items: [{ id: "image-1", expectedUpdatedAt: UPDATED_AT }] }],
    ["reorder blank id", vehicleImageReorderSchema, { group: "PRIMARY", items: [{ id: " ", expectedUpdatedAt: UPDATED_AT }] }],
  ])("rejects malformed JSON input: %s", (_label, schema, input) => {
    // Given / When
    const result = schema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });

  it("accepts an empty reorder shape so DB policy can validate an empty complete group", () => {
    // Given / When
    const result = vehicleImageReorderSchema.safeParse({ group: "PRIMARY", expectedImageRevision: 0, items: [] });

    // Then
    expect(result.success).toBe(true);
  });

  it("rejects duplicate reorder IDs at the boundary", () => {
    // Given
    const input = {
      group: "PRIMARY",
      items: [
        { id: "image-1", expectedUpdatedAt: UPDATED_AT },
        { id: "image-1", expectedUpdatedAt: UPDATED_AT },
      ],
    };

    // When
    const result = vehicleImageReorderSchema.safeParse(input);

    // Then
    expect(result.success).toBe(false);
  });
});
