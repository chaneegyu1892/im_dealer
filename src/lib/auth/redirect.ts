const INTERNAL_ORIGIN = "https://internal.imdealer.invalid";
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;

export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/"
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    CONTROL_CHARACTER.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);
    // URL normalization can turn an encoded dot segment into a
    // protocol-relative pathname. Never return that shape to a router.
    if (url.origin !== INTERNAL_ORIGIN || url.pathname.startsWith("//")) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (error) {
    if (error instanceof Error) return fallback;
    throw error;
  }
}
