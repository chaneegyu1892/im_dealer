export const QUOTE_IMAGE_BUCKET = "quotes";

// 카카오가 전달 직후 이미지를 스크랩할 시간을 확보하되, 공개 객체와
// CDN 캐시가 장기간 남지 않도록 수명을 명시적으로 제한한다.
export const QUOTE_IMAGE_RETENTION_DAYS = 7;
export const QUOTE_IMAGE_CACHE_CONTROL_SECONDS = 24 * 60 * 60;

export function quoteImagePublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${QUOTE_IMAGE_BUCKET}/${path}`;
}
