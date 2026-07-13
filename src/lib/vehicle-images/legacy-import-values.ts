export function parseLegacyInteger(
  value: string | number | undefined | null,
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Math.round(value);
  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function splitLegacyCsv(value: string | undefined | null): string[] {
  if (!value) return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}
