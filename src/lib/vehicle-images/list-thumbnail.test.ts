import { createCanvas, loadImage } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import {
  VEHICLE_LIST_THUMBNAIL_BACKGROUND,
  VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE,
  VEHICLE_LIST_THUMBNAIL_HEIGHT,
  VEHICLE_LIST_THUMBNAIL_WIDTH,
  renderVehicleListThumbnail,
  vehicleImageStoragePathFromPublicUrl,
  vehicleListThumbnailPath,
} from "./list-thumbnail";

function createWideSource(): Uint8Array<ArrayBuffer> {
  const canvas = createCanvas(1_200, 300);
  const context = canvas.getContext("2d");
  context.fillStyle = "#D7263D";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return Uint8Array.from(canvas.toBuffer("image/png"));
}

describe("renderVehicleListThumbnail", () => {
  it("creates an opaque 4:3 WebP canvas without cropping a wide source", async () => {
    const output = await renderVehicleListThumbnail(createWideSource());
    const decoded = await loadImage(output);
    const inspection = createCanvas(decoded.width, decoded.height);
    const context = inspection.getContext("2d");
    context.drawImage(decoded, 0, 0);

    expect(VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE).toBe("image/webp");
    expect(decoded.width).toBe(VEHICLE_LIST_THUMBNAIL_WIDTH);
    expect(decoded.height).toBe(VEHICLE_LIST_THUMBNAIL_HEIGHT);

    const [cornerRed = 0, cornerGreen = 0, cornerBlue = 0, cornerAlpha = 0] = context
      .getImageData(0, 0, 1, 1).data;
    const [centerRed = 0, centerGreen = 0, centerBlue = 0] = (
      context.getImageData(
        VEHICLE_LIST_THUMBNAIL_WIDTH / 2,
        VEHICLE_LIST_THUMBNAIL_HEIGHT / 2,
        1,
        1,
      ).data
    );
    expect(cornerRed).toBeGreaterThanOrEqual(242);
    expect(cornerGreen).toBeGreaterThanOrEqual(243);
    expect(cornerBlue).toBeGreaterThanOrEqual(245);
    expect(cornerAlpha).toBe(255);
    expect(centerRed).toBeGreaterThan(190);
    expect(centerGreen).toBeLessThan(80);
    expect(centerBlue).toBeLessThan(100);
    expect(VEHICLE_LIST_THUMBNAIL_BACKGROUND).toBe("#F7F8FA");
  });

  it("uses a versioned sibling key derived from the immutable original path", () => {
    expect(vehicleListThumbnailPath("admin/vehicle-1/photo.jpeg")).toBe(
      "list-thumbnails/v1/admin/vehicle-1/photo.webp",
    );
    expect(() => vehicleListThumbnailPath("../outside.jpg")).toThrow("INVALID_SOURCE_PATH");
  });

  it("extracts only owned vehicle-image storage paths from public URLs", () => {
    expect(vehicleImageStoragePathFromPublicUrl(
      "https://project.supabase.co/storage/v1/object/public/vehicle-images/ab/photo.jpg",
    )).toBe("ab/photo.jpg");
    expect(vehicleImageStoragePathFromPublicUrl(
      "https://project.supabase.co/storage/v1/object/public/other-bucket/ab/photo.jpg",
    )).toBeNull();
  });
});
