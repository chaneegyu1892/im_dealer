export function summarizeVehicleDescription(
  description: string | null | undefined,
  maxLength = 42,
) {
  const normalized = (description ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;

  const hardCut = normalized.slice(0, maxLength);
  const punctuationCut = Math.max(
    hardCut.lastIndexOf("."),
    hardCut.lastIndexOf(","),
    hardCut.lastIndexOf("·"),
  );
  const spaceCut = hardCut.lastIndexOf(" ");
  const fallbackCut = spaceCut >= Math.floor(maxLength * 0.7) ? spaceCut : maxLength;
  const cutIndex = punctuationCut >= Math.floor(maxLength * 0.45) ? punctuationCut : fallbackCut;
  return `${normalized.slice(0, cutIndex).trim()}...`;
}
