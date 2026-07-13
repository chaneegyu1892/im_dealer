import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { VEHICLE_IMAGE_BUCKET } from "@/lib/vehicle-image-mirror";
import {
  deleteFilesystemVehicleImage,
  FilesystemE2EStorageError,
  uploadFilesystemVehicleImage,
} from "@/lib/vehicle-images/filesystem-e2e-storage";

export const REVIEW_IMAGE_BUCKET = "review-images";
export const REVIEW_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const REVIEW_IMAGE_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ADMIN_UPLOAD_BUCKET = "admin-uploads";
export const ADMIN_UPLOAD_MAX_SIZE = 5 * 1024 * 1024;
export const ADMIN_UPLOAD_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
export const ADMIN_UPLOAD_CATEGORIES = [
  "vehicles",
  "brands",
  "trims",
  "colors",
  "finance",
  "misc",
] as const;
export type AdminUploadCategory = (typeof ADMIN_UPLOAD_CATEGORIES)[number];

export class VehicleImageStorageError extends Error {
  readonly name = "VehicleImageStorageError";

  constructor(
    readonly operation: "upload" | "delete",
    message: string,
    readonly objectMayExist = false,
  ) {
    super(`VEHICLE_IMAGE_STORAGE_${operation.toUpperCase()}_FAILED: ${message}`);
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function reviewImagePublicUrlPrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${REVIEW_IMAGE_BUCKET}/`;
}

export function isReviewImagePublicUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith(reviewImagePublicUrlPrefix());
}

export async function uploadReviewImage(params: {
  tokenFolder: string;
  file: Blob;
  contentType: string;
}): Promise<{ url: string; path: string }> {
  const ext = EXT_BY_MIME[params.contentType];
  if (!ext) throw new Error("UNSUPPORTED_MIME");

  const path = `${params.tokenFolder}/${randomUUID()}.${ext}`;
  const admin = supabaseAdmin();
  const { error } = await admin.storage
    .from(REVIEW_IMAGE_BUCKET)
    .upload(path, params.file, {
      contentType: params.contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);
  }

  const { data } = admin.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// ─── 어드민 업로드 (차량/브랜드/트림/색상 등) ─────────────────────────────

export function adminUploadPublicUrlPrefix(): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${ADMIN_UPLOAD_BUCKET}/`;
}

export function isAdminUploadPublicUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith(adminUploadPublicUrlPrefix());
}

export async function uploadAdminFile(params: {
  category: AdminUploadCategory;
  file: Blob;
  contentType: string;
}): Promise<{ url: string; path: string }> {
  const ext = EXT_BY_MIME[params.contentType];
  if (!ext) throw new Error("UNSUPPORTED_MIME");

  const path = `${params.category}/${randomUUID()}.${ext}`;
  const admin = supabaseAdmin();
  const { error } = await admin.storage
    .from(ADMIN_UPLOAD_BUCKET)
    .upload(path, params.file, {
      contentType: params.contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);
  }

  const { data } = admin.storage.from(ADMIN_UPLOAD_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

// 업로드된 어드민 파일 삭제 (Vehicle 삭제/이미지 교체 시 cleanup용 — 이번 PR에선 호출부 없음)
export async function deleteAdminFile(path: string): Promise<void> {
  const admin = supabaseAdmin();
  const { error } = await admin.storage.from(ADMIN_UPLOAD_BUCKET).remove([path]);
  if (error) throw new Error(`STORAGE_DELETE_FAILED: ${error.message}`);
}

// 공개 URL에서 bucket 내부 path 추출 (cleanup용)
export function adminUploadPathFromUrl(url: string): string | null {
  const prefix = adminUploadPublicUrlPrefix();
  if (!url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

export function vehicleImagePublicUrl(path: string): string {
  const { data } = supabaseAdmin().storage.from(VEHICLE_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function isDeterministicUploadRejection(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if (!("name" in error) || error.name !== "StorageApiError") return false;
  if (!("status" in error) || typeof error.status !== "number") return false;
  return error.status >= 400 && error.status < 500;
}

function storageErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

export async function uploadVehicleImageObject(params: {
  readonly path: string;
  readonly file: Blob;
  readonly contentType: string;
}): Promise<string> {
  if (process.env.VEHICLE_IMAGE_STORAGE_DRIVER === "filesystem-e2e") {
    try {
      return await uploadFilesystemVehicleImage(params);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new VehicleImageStorageError("upload", message, !(cause instanceof FilesystemE2EStorageError));
    }
  }
  let error: unknown = null;
  try {
    const result = await supabaseAdmin().storage.from(VEHICLE_IMAGE_BUCKET).upload(
      params.path,
      params.file,
      { contentType: params.contentType, cacheControl: "31536000", upsert: false },
    );
    error = result.error;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new VehicleImageStorageError("upload", message, true);
  }
  if (error) {
    throw new VehicleImageStorageError(
      "upload",
      storageErrorMessage(error),
      !isDeterministicUploadRejection(error),
    );
  }
  return vehicleImagePublicUrl(params.path);
}

export async function deleteVehicleImageObject(path: string): Promise<void> {
  if (process.env.VEHICLE_IMAGE_STORAGE_DRIVER === "filesystem-e2e") {
    await deleteFilesystemVehicleImage(path);
    return;
  }
  const { error } = await supabaseAdmin().storage.from(VEHICLE_IMAGE_BUCKET).remove([path]);
  if (error && !/not found|404/i.test(error.message)) {
    throw new VehicleImageStorageError("delete", error.message);
  }
}
