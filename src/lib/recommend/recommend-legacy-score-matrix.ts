function property(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return Object.entries(value).find(([candidate]) => candidate === key)?.[1];
}

export function readLegacyScoreMatrixBonus(
  value: unknown,
  industry: string,
  purpose: string | undefined,
): number {
  if (!purpose) return 0;
  const bonus = property(property(value, industry), purpose);
  return typeof bonus === "number" && bonus > 0 ? bonus : 0;
}
