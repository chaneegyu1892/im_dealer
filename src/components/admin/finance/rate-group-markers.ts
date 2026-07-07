import type { CapitalRateSheet, RateSheetKey, RateSheetRaw } from "@/types/admin";

export interface VisibleTrimForRateGroup {
  id: string;
}

export interface RateGroupMarker {
  ariaLabel: string;
  className: string;
  title: string;
}

interface BuildRateGroupMarkersParams {
  activeSheets: readonly CapitalRateSheet[];
  productType: string;
  trims: readonly VisibleTrimForRateGroup[];
}

interface RateGroupBucket {
  key: string;
  trimIds: string[];
}

const RATE_SHEET_KEYS = [
  "36_10000",
  "36_20000",
  "36_30000",
  "48_10000",
  "48_20000",
  "48_30000",
  "60_10000",
  "60_20000",
  "60_30000",
] satisfies readonly RateSheetKey[];

const RATE_GROUP_COLOR_CLASS_NAMES = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-fuchsia-500",
  "bg-blue-600",
  "bg-lime-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-amber-500",
] as const;

const EMPTY_RATE_MARKER: RateGroupMarker = {
  ariaLabel: "입력 금액 없는 회수율 시트",
  className: "bg-amber-400",
  title: "회수율 시트 있음 · 입력 금액 없음",
};

const SINGLE_RATE_MARKER: RateGroupMarker = {
  ariaLabel: "단독 회수율 시트",
  className: "bg-slate-300",
  title: "회수율 시트 있음 · 단독 회수율",
};

function normalizeRateValue(value: number): string {
  if (!Number.isFinite(value)) return "0.00000000";
  return value.toFixed(8);
}

function serializeRateSheet(sheet: RateSheetRaw): string {
  return RATE_SHEET_KEYS.map((key) => `${key}:${normalizeRateValue(sheet[key])}`).join("|");
}

function buildRateGroupKey(sheet: CapitalRateSheet): string {
  return [
    serializeRateSheet(sheet.minRateMatrix),
    serializeRateSheet(sheet.maxRateMatrix),
    normalizeRateValue(sheet.depositDiscountRate),
    normalizeRateValue(sheet.prepayAdjustRate),
  ].join("||");
}

function hasPositiveRateMatrix(sheet: RateSheetRaw): boolean {
  return RATE_SHEET_KEYS.some((key) => sheet[key] > 0);
}

function hasUsableRateValues(sheet: CapitalRateSheet): boolean {
  return hasPositiveRateMatrix(sheet.minRateMatrix) || hasPositiveRateMatrix(sheet.maxRateMatrix);
}

function makeGroupLabel(index: number): string {
  const alphabetLength = 26;
  const charCodeA = 65;
  let value = index;
  let label = "";

  do {
    label = String.fromCharCode(charCodeA + (value % alphabetLength)) + label;
    value = Math.floor(value / alphabetLength) - 1;
  } while (value >= 0);

  return label;
}

function makeGroupMarker(index: number, groupSize: number): RateGroupMarker {
  const label = makeGroupLabel(index);
  return {
    ariaLabel: `동일 회수율 그룹 ${label}`,
    className: RATE_GROUP_COLOR_CLASS_NAMES[index % RATE_GROUP_COLOR_CLASS_NAMES.length],
    title: `동일 회수율 그룹 ${label} · 이 차량 내 ${groupSize}개 트림`,
  };
}

export function buildRateGroupMarkers({
  activeSheets,
  productType,
  trims,
}: BuildRateGroupMarkersParams): Map<string, RateGroupMarker> {
  const visibleTrimIds = new Set(trims.map((trim) => trim.id));
  const sheetByTrimId = new Map<string, CapitalRateSheet>();

  for (const sheet of activeSheets) {
    if (sheet.productType !== productType) continue;
    if (!visibleTrimIds.has(sheet.trimId)) continue;
    if (sheetByTrimId.has(sheet.trimId)) continue;
    sheetByTrimId.set(sheet.trimId, sheet);
  }

  const groups = new Map<string, RateGroupBucket>();
  for (const sheet of sheetByTrimId.values()) {
    if (!hasUsableRateValues(sheet)) continue;

    const groupKey = buildRateGroupKey(sheet);
    const group = groups.get(groupKey) ?? { key: groupKey, trimIds: [] };
    group.trimIds.push(sheet.trimId);
    groups.set(groupKey, group);
  }

  const repeatedGroups = Array.from(groups.values())
    .filter((group) => group.trimIds.length > 1)
    .sort((a, b) => b.trimIds.length - a.trimIds.length || a.key.localeCompare(b.key));
  const markerByGroupKey = new Map<string, RateGroupMarker>();

  repeatedGroups.forEach((group, index) => {
    markerByGroupKey.set(group.key, makeGroupMarker(index, group.trimIds.length));
  });

  const markerByTrimId = new Map<string, RateGroupMarker>();
  for (const sheet of sheetByTrimId.values()) {
    if (!hasUsableRateValues(sheet)) {
      markerByTrimId.set(sheet.trimId, EMPTY_RATE_MARKER);
      continue;
    }

    markerByTrimId.set(
      sheet.trimId,
      markerByGroupKey.get(buildRateGroupKey(sheet)) ?? SINGLE_RATE_MARKER
    );
  }

  return markerByTrimId;
}
