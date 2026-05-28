import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

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
  "misc",
] as const;
export type AdminUploadCategory = (typeof ADMIN_UPLOAD_CATEGORIES)[number];

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
