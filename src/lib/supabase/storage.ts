import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const REVIEW_IMAGE_BUCKET = "review-images";
export const REVIEW_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
export const REVIEW_IMAGE_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
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
