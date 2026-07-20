import { describe, expect, it } from "vitest";
import {
  buildVehicleListThumbnailBackfillCasWhere,
  parseVehicleListThumbnailBackfillArgs,
} from "./backfill-vehicle-list-thumbnails";

describe("parseVehicleListThumbnailBackfillArgs", () => {
  it("defaults to a read-only dry-run", () => {
    expect(parseVehicleListThumbnailBackfillArgs([])).toEqual({
      apply: false,
      concurrency: 4,
      limit: null,
    });
  });

  it("requires the exact write confirmation", () => {
    expect(() => parseVehicleListThumbnailBackfillArgs(["--apply"])).toThrow(
      "--apply requires --confirm vehicle-list-thumbnail-v1",
    );
    expect(parseVehicleListThumbnailBackfillArgs([
      "--apply",
      "--confirm",
      "vehicle-list-thumbnail-v1",
      "--limit",
      "10",
    ])).toEqual({
      apply: true,
      concurrency: 4,
      limit: 10,
    });
  });

  it("rejects conflicting write modes", () => {
    expect(() => parseVehicleListThumbnailBackfillArgs([
      "--dry-run",
      "--apply",
      "--confirm",
      "vehicle-list-thumbnail-v1",
    ])).toThrow("choose exactly one");
  });

  it("compares the scanned source identity before attaching a derivative", () => {
    expect(buildVehicleListThumbnailBackfillCasWhere({
      imageId: "image-1",
      expectedStorageUrl: "https://storage.example/original.webp",
      expectedAdminStoragePath: "admin/vehicle-1/original.webp",
    })).toEqual({
      id: "image-1",
      storageUrl: "https://storage.example/original.webp",
      adminStoragePath: "admin/vehicle-1/original.webp",
      deletedAt: null,
      OR: [
        { listThumbnailUrl: null },
        { listThumbnailStoragePath: null },
      ],
    });
  });
});
