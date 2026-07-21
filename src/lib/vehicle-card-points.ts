import type { VehicleListItem } from "@/types/api";

const MAX_POINTS = 3;
const MAX_GRADE_LENGTH = 12;
const EV_NAME_RE = /전기|\bEV(?:\b|\d)/i;
const HEV_NAME_RE = /HEV|하이브리드|hybrid|E[-\s]?TECH/i;
const HYDROGEN_NAME_RE = /넥쏘|수소|hydrogen/i;
const VERBOSE_TRIM_RE = /\d{4}년형|가솔린|디젤|하이브리드|\bEV\b|LPG|\d\.\d|개소세|\d+인승|\b(?:2WD|4WD|AWD)\b/i;

type VehicleCardPointInput = Pick<VehicleListItem, "name" | "defaultTrim" | "hashtags">;

function normalizePoint(raw: string): string {
  const value = raw.trim().replace(/^#+/, "").trim();
  return value ? `#${value}` : "";
}

function getFuelPoint(vehicle: VehicleCardPointInput): string | null {
  // DB에는 현재 타입에 없는 수소/LPG 값도 남아 있어 런타임 문자열까지 안전하게 판별한다.
  const engineType = vehicle.defaultTrim?.engineType as string | undefined;

  // 차량명 신호를 함께 확인해 HEV 모델이 원천 데이터상 가솔린으로 분류된 경우도 보정한다.
  if (engineType === "EV" || EV_NAME_RE.test(vehicle.name)) return "#전기차";
  if (engineType === "하이브리드" || HEV_NAME_RE.test(vehicle.name)) return "#하이브리드";
  if (engineType === "수소" || HYDROGEN_NAME_RE.test(vehicle.name)) return "#수소차";
  if (engineType === "LPG") return "#LPG";
  if (engineType === "디젤") return "#디젤";
  if (engineType === "가솔린") return "#가솔린";
  return null;
}

function getGradePoint(vehicle: VehicleCardPointInput): string | null {
  const trim = vehicle.defaultTrim;
  if (!trim) return null;

  const structuredName = trim.specs?.trimName?.trim();
  if (structuredName && structuredName.length <= MAX_GRADE_LENGTH) {
    return normalizePoint(structuredName);
  }

  const fallbackName = trim.name.trim();
  if (
    !fallbackName ||
    fallbackName.length > MAX_GRADE_LENGTH ||
    VERBOSE_TRIM_RE.test(fallbackName)
  ) {
    return null;
  }

  return normalizePoint(fallbackName);
}

/**
 * 차량 목록 카드용 짧은 포인트.
 * 원문 설명을 잘라 쓰지 않고 연료, 구조화된 트림명, 기존 해시태그 순으로 최대 3개를 노출한다.
 */
export function getVehicleCardPoints(vehicle: VehicleCardPointInput): string[] {
  const points: string[] = [];
  const push = (raw: string | null | undefined) => {
    if (!raw) return;
    const point = normalizePoint(raw);
    if (point && !points.includes(point)) points.push(point);
  };

  push(getFuelPoint(vehicle));
  push(getGradePoint(vehicle));
  for (const hashtag of vehicle.hashtags ?? []) push(hashtag);

  return points.slice(0, MAX_POINTS);
}
