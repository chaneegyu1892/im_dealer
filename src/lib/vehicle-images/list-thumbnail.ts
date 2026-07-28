import { posix } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const VEHICLE_LIST_THUMBNAIL_WIDTH = 960;
export const VEHICLE_LIST_THUMBNAIL_HEIGHT = 720;
export const VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE = "image/webp";
export const VEHICLE_LIST_THUMBNAIL_BACKGROUND = "#F7F8FA";
const VEHICLE_LIST_THUMBNAIL_QUALITY = 88;
const VEHICLE_LIST_THUMBNAIL_PREFIX = "list-thumbnails/v1";
const VEHICLE_IMAGE_PUBLIC_URL_MARKER = "/storage/v1/object/public/vehicle-images/";

export class VehicleListThumbnailError extends Error {
  readonly name = "VehicleListThumbnailError";

  constructor(
    readonly code: "INVALID_SOURCE_PATH" | "INVALID_IMAGE",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

export function vehicleListThumbnailPath(sourcePath: string): string {
  const normalized = sourcePath.trim();
  if (
    !/^[A-Za-z0-9._/-]+$/.test(normalized)
    || normalized.startsWith("/")
    || normalized.endsWith("/")
    || normalized.split("/").includes("..")
  ) {
    throw new VehicleListThumbnailError("INVALID_SOURCE_PATH");
  }
  const extension = posix.extname(normalized);
  const stem = extension === "" ? normalized : normalized.slice(0, -extension.length);
  return `${VEHICLE_LIST_THUMBNAIL_PREFIX}/${stem}.webp`;
}

export function vehicleImageStoragePathFromPublicUrl(storageUrl: string): string | null {
  try {
    const parsed = new URL(storageUrl);
    const markerIndex = parsed.pathname.indexOf(VEHICLE_IMAGE_PUBLIC_URL_MARKER);
    if (markerIndex < 0) return null;
    const encodedPath = parsed.pathname.slice(
      markerIndex + VEHICLE_IMAGE_PUBLIC_URL_MARKER.length,
    );
    const storagePath = decodeURIComponent(encodedPath);
    vehicleListThumbnailPath(storagePath);
    return storagePath;
  } catch {
    return null;
  }
}

export async function renderVehicleListThumbnail(
  source: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const image = await loadImage(source);
    if (image.width <= 0 || image.height <= 0) {
      throw new VehicleListThumbnailError("INVALID_IMAGE");
    }

    const canvas = createCanvas(
      VEHICLE_LIST_THUMBNAIL_WIDTH,
      VEHICLE_LIST_THUMBNAIL_HEIGHT,
    );
    const context = canvas.getContext("2d");
    context.fillStyle = VEHICLE_LIST_THUMBNAIL_BACKGROUND;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const scale = Math.min(
      VEHICLE_LIST_THUMBNAIL_WIDTH / image.width,
      VEHICLE_LIST_THUMBNAIL_HEIGHT / image.height,
    );
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const x = Math.round((VEHICLE_LIST_THUMBNAIL_WIDTH - width) / 2);
    const y = Math.round((VEHICLE_LIST_THUMBNAIL_HEIGHT - height) / 2);
    context.drawImage(image, x, y, width, height);

    return Uint8Array.from(
      await canvas.encode("webp", VEHICLE_LIST_THUMBNAIL_QUALITY),
    );
  } catch (cause) {
    if (cause instanceof VehicleListThumbnailError) throw cause;
    throw new VehicleListThumbnailError("INVALID_IMAGE", cause);
  }
}
