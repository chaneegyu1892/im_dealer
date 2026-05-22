/**
 * 차량 이미지 미러링 헬퍼
 *
 * 외부 CDN(p.ca8.kr, hyundai.com 등) 이미지를 Supabase Storage `vehicle-images` 버킷으로
 * 복제하고 공개 URL을 반환한다. SHA-256 콘텐츠 해시를 키로 사용해 중복 다운로드를 방지한다.
 *
 * - 이미 우리 Supabase Storage URL이면 그대로 반환 (멱등성)
 * - data: URI / 상대 경로(/...로 시작) / 빈 값은 변환 없이 그대로 반환
 * - 다운로드 실패 시 throw → 호출부에서 결정 (스킵 vs 중단)
 */

import { createHash } from "node:crypto";
import { extname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

export const VEHICLE_IMAGE_BUCKET = "vehicle-images";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

export interface MirrorContext {
  supabase: SupabaseClient;
  /** 다운로드 timeout(ms). 기본 15s */
  timeoutMs?: number;
  /** 이미 미러링된 외부 URL → 새 URL 캐시 (스크립트 1회 실행 안에서 재사용) */
  cache?: Map<string, string>;
}

export interface MirrorResult {
  /** 최종 URL (성공 시 Supabase 공개 URL, 변환 불필요 시 원본) */
  url: string;
  /** true면 새로 업로드, false면 캐시/원본 반환 */
  uploaded: boolean;
}

/**
 * 외부 절대 URL을 우리 버킷으로 복제. 상대 경로/데이터 URI/이미 Supabase URL은 통과.
 */
export async function mirrorImage(rawUrl: string | null | undefined, ctx: MirrorContext): Promise<MirrorResult> {
  const url = (rawUrl ?? "").trim();
  if (!url) return { url: "", uploaded: false };

  // 이미 Supabase Storage URL 또는 상대 경로 / data URI → 통과
  if (
    url.startsWith("data:") ||
    url.startsWith("/") ||
    /\/storage\/v1\/object\/public\/vehicle-images\//.test(url)
  ) {
    return { url, uploaded: false };
  }

  // 절대 URL 검증
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, uploaded: false };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url, uploaded: false };
  }

  const cache = ctx.cache;
  if (cache?.has(url)) return { url: cache.get(url)!, uploaded: false };

  const buffer = await downloadToBuffer(url, ctx.timeoutMs ?? 15000);
  const ext = pickExtension(parsed.pathname, buffer.contentType);
  const hash = createHash("sha256").update(buffer.bytes).digest("hex");
  const objectKey = `${hash.slice(0, 2)}/${hash}${ext}`;
  const contentType = buffer.contentType || guessMimeFromExt(ext);

  const uploadRes = await ctx.supabase.storage
    .from(VEHICLE_IMAGE_BUCKET)
    .upload(objectKey, buffer.bytes, {
      contentType,
      cacheControl: "31536000, immutable",
      upsert: false,
    });

  // 'already exists'는 동일 해시 → 같은 파일이므로 OK
  if (uploadRes.error) {
    const msg = uploadRes.error.message ?? "";
    const isDuplicate = /already exists|duplicate|409|resource exists/i.test(msg);
    if (!isDuplicate) {
      throw new Error(`Supabase upload failed for ${url}: ${msg}`);
    }
  }

  const { data: pub } = ctx.supabase.storage.from(VEHICLE_IMAGE_BUCKET).getPublicUrl(objectKey);
  const mirroredUrl = pub.publicUrl;

  cache?.set(url, mirroredUrl);
  return { url: mirroredUrl, uploaded: !uploadRes.error };
}

/**
 * 여러 URL 배열을 순차 미러링. 한 장 실패해도 나머지는 계속 진행.
 * 실패한 URL은 제외하고 성공한 것만 반환.
 */
export async function mirrorImages(
  urls: readonly (string | null | undefined)[],
  ctx: MirrorContext,
  onError?: (originalUrl: string, error: Error) => void,
): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    try {
      const r = await mirrorImage(u, ctx);
      if (r.url) out.push(r.url);
    } catch (err) {
      onError?.(u, err instanceof Error ? err : new Error(String(err)));
    }
  }
  return out;
}

interface DownloadResult {
  bytes: Uint8Array;
  contentType: string;
}

async function downloadToBuffer(url: string, timeoutMs: number): Promise<DownloadResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 핫링크 회피용 User-Agent. 일부 CDN은 Referer 검사하므로 안 보냄(브라우저처럼).
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength === 0) {
      throw new Error("empty response body");
    }
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    return { bytes: new Uint8Array(arrayBuf), contentType };
  } finally {
    clearTimeout(timer);
  }
}

function pickExtension(pathname: string, contentType: string): string {
  const fromCT = MIME_TO_EXT[contentType];
  if (fromCT) return fromCT;
  const fromPath = extname(pathname).toLowerCase();
  if (SUPPORTED_EXTENSIONS.has(fromPath)) return fromPath === ".jpeg" ? ".jpg" : fromPath;
  return ".jpg";
}

function guessMimeFromExt(ext: string): string {
  for (const [mime, e] of Object.entries(MIME_TO_EXT)) {
    if (e === ext) return mime;
  }
  return "image/jpeg";
}
