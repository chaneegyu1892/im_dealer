import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it, vi } from "vitest";
import { backfillVehicleListThumbnails } from "./list-thumbnail-backfill";

function sourceBytes(): Uint8Array<ArrayBuffer> {
  const canvas = createCanvas(800, 300);
  const context = canvas.getContext("2d");
  context.fillStyle = "#123456";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return Uint8Array.from(canvas.toBuffer("image/png"));
}

describe("backfillVehicleListThumbnails", () => {
  it("uploads and saves a 4:3 derivative for an owned existing image", async () => {
    const download = vi.fn().mockResolvedValue(sourceBytes());
    const upload = vi.fn().mockResolvedValue(
      "https://project.supabase.co/storage/v1/object/public/vehicle-images/list-thumbnails/v1/admin/vehicle-1/photo.webp",
    );
    const reservation = {
      storagePath: "list-thumbnails/v1/admin/vehicle-1/photo.webp",
      token: "reservation-token",
    };
    const reserve = vi.fn().mockResolvedValue(reservation);
    const rollback = vi.fn();
    const commit = vi.fn().mockResolvedValue(true);

    const stats = await backfillVehicleListThumbnails({
      apply: true,
      images: [{
        id: "image-1",
        storageUrl: "https://project.supabase.co/storage/v1/object/public/vehicle-images/admin/vehicle-1/photo.jpg",
        adminStoragePath: "admin/vehicle-1/photo.jpg",
      }],
      storage: { download, upload },
      cleanup: { reserve, rollback },
      commit,
      concurrency: 1,
    });

    expect(stats).toEqual({
      eligible: 1,
      updated: 1,
      skippedUnowned: 0,
      skippedConcurrent: 0,
      failed: 0,
    });
    expect(download).toHaveBeenCalledWith("admin/vehicle-1/photo.jpg");
    expect(upload).toHaveBeenCalledWith(
      "list-thumbnails/v1/admin/vehicle-1/photo.webp",
      expect.any(Uint8Array),
    );
    expect(reserve).toHaveBeenCalledWith(
      "list-thumbnails/v1/admin/vehicle-1/photo.webp",
    );
    expect(commit).toHaveBeenCalledWith({
      imageId: "image-1",
      expectedStorageUrl: "https://project.supabase.co/storage/v1/object/public/vehicle-images/admin/vehicle-1/photo.jpg",
      expectedAdminStoragePath: "admin/vehicle-1/photo.jpg",
      listThumbnailUrl: expect.stringContaining("/list-thumbnails/v1/"),
      listThumbnailStoragePath: "list-thumbnails/v1/admin/vehicle-1/photo.webp",
      reservation,
    });
    expect(rollback).not.toHaveBeenCalled();
  });

  it("keeps dry-run read-only and reports external legacy sources separately", async () => {
    const download = vi.fn();
    const upload = vi.fn();
    const reserve = vi.fn();
    const rollback = vi.fn();
    const commit = vi.fn();
    const stats = await backfillVehicleListThumbnails({
      apply: false,
      images: [{
        id: "image-external",
        storageUrl: "https://external.example/photo.jpg",
        adminStoragePath: null,
      }],
      storage: { download, upload },
      cleanup: { reserve, rollback },
      commit,
      concurrency: 1,
    });

    expect(stats).toEqual({
      eligible: 0,
      updated: 0,
      skippedUnowned: 1,
      skippedConcurrent: 0,
      failed: 0,
    });
    expect(download).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it("readies the durable cleanup reservation when DB commit fails", async () => {
    const reservation = {
      storagePath: "list-thumbnails/v1/admin/vehicle-1/photo.webp",
      token: "reservation-token",
    };
    const rollback = vi.fn().mockResolvedValue(undefined);
    const stats = await backfillVehicleListThumbnails({
      apply: true,
      images: [{
        id: "image-1",
        storageUrl: "https://project.supabase.co/storage/v1/object/public/vehicle-images/admin/vehicle-1/photo.jpg",
        adminStoragePath: "admin/vehicle-1/photo.jpg",
      }],
      storage: {
        download: vi.fn().mockResolvedValue(sourceBytes()),
        upload: vi.fn().mockResolvedValue("https://storage.example/list.webp"),
      },
      cleanup: {
        reserve: vi.fn().mockResolvedValue(reservation),
        rollback,
      },
      commit: vi.fn().mockRejectedValue(new Error("database unavailable")),
      concurrency: 1,
    });

    expect(stats.failed).toBe(1);
    expect(rollback).toHaveBeenCalledWith(reservation);
  });
});
