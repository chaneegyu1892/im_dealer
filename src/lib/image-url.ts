export function isSupabaseStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith(".supabase.co") && parsed.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}
