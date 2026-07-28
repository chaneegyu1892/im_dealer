import {
  VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE,
  renderVehicleListThumbnail,
  vehicleImageStoragePathFromPublicUrl,
  vehicleListThumbnailPath,
} from "../vehicle-images/list-thumbnail";
import {
  VEHICLE_IMAGE_BUCKET,
  type MirrorContext,
} from "../vehicle-image-mirror";

export type Carpan2ListThumbnail = {
  readonly url: string;
  readonly storagePath: string;
};

export class Carpan2ListThumbnailError extends Error {
  readonly name = "Carpan2ListThumbnailError";

  constructor(
    readonly code: "UNOWNED_SOURCE" | "DOWNLOAD_FAILED" | "UPLOAD_FAILED",
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

export async function createCarpan2ListThumbnail(input: {
  readonly ctx: MirrorContext;
  readonly storageUrl: string;
  readonly reserveBeforeUpload: (storagePath: string) => Promise<void>;
}): Promise<Carpan2ListThumbnail> {
  const sourcePath = vehicleImageStoragePathFromPublicUrl(input.storageUrl);
  if (sourcePath === null) {
    throw new Carpan2ListThumbnailError("UNOWNED_SOURCE");
  }

  const downloaded = await input.ctx.supabase.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .download(sourcePath);
  if (downloaded.error || downloaded.data === null) {
    throw new Carpan2ListThumbnailError("DOWNLOAD_FAILED", downloaded.error);
  }

  const sourceBytes = Uint8Array.from(
    new Uint8Array(await downloaded.data.arrayBuffer()),
  );
  const thumbnailBytes = await renderVehicleListThumbnail(sourceBytes);
  const storagePath = vehicleListThumbnailPath(sourcePath);
  await input.reserveBeforeUpload(storagePath);
  const uploaded = await input.ctx.supabase.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .upload(storagePath, thumbnailBytes, {
      contentType: VEHICLE_LIST_THUMBNAIL_CONTENT_TYPE,
      cacheControl: "31536000, immutable",
      upsert: false,
    });
  if (uploaded.error && !/already exists|duplicate|409|resource exists/i.test(uploaded.error.message ?? "")) {
    throw new Carpan2ListThumbnailError("UPLOAD_FAILED", uploaded.error);
  }

  const { data } = input.ctx.supabase.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .getPublicUrl(storagePath);
  return { url: data.publicUrl, storagePath };
}
