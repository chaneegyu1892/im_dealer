function retryCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  if (typeof error.code !== "string") return null;
  return error.code;
}

function metadataCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("meta" in error)) return null;
  const metadata = error.meta;
  if (typeof metadata !== "object" || metadata === null || !("code" in metadata)) return null;
  return typeof metadata.code === "string" ? metadata.code : null;
}

export function isRetryableTransactionError(error: unknown): boolean {
  const code = retryCode(error);
  const sqlState = metadataCode(error);
  return code === "P2034"
    || code === "40P01"
    || code === "40001"
    || sqlState === "40P01"
    || sqlState === "40001";
}
