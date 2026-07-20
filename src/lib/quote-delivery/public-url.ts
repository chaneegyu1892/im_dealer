export const QUOTE_IMAGE_BUCKET = "quotes";

export function quoteImagePublicUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${QUOTE_IMAGE_BUCKET}/${path}`;
}
