// 차량 단위 "옵션명 → 배지" 매핑(VehicleOptionBadge) 공용 로직.
// 배지는 트림 옵션 행이 아니라 옵션명에 붙으므로, 조회 시 이름 매칭으로 배지를 해석한다.

/**
 * 옵션명 정규화 — 매핑 키와 트림 옵션명 매칭의 공통 기준.
 * 외부 데이터 소스에서 같은 옵션이 트림마다 공백만 다르게 들어오는 경우를 흡수한다.
 */
export function normalizeOptionName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * 매핑 목록으로 "옵션명 → 배지" 조회 함수를 만든다.
 * 반환된 함수는 정규화된 이름으로 매칭하며, 매핑이 없으면 null.
 */
export function buildOptionBadgeLookup<T>(
  mappings: ReadonlyArray<{ optionName: string; badge: T }>
): (optionName: string) => T | null {
  const map = new Map<string, T>();
  for (const mapping of mappings) {
    map.set(normalizeOptionName(mapping.optionName), mapping.badge);
  }
  return (optionName) => map.get(normalizeOptionName(optionName)) ?? null;
}

/** 어드민 일괄 지정 화면의 행 — 차량 전체 트림에서 이름 기준으로 중복 제거한 옵션 */
export interface VehicleOptionSummary {
  /** 매핑 키(정규화된 옵션명) */
  name: string;
  category: string | null;
  isAccessory: boolean;
  /** 이 옵션명이 포함된 트림 수 */
  trimCount: number;
}

/**
 * 차량의 모든 트림 옵션을 이름 기준으로 중복 제거해 나열한다.
 * 요청 명세의 "차량의 모든 옵션을 나열함 → 그 옵션에 배지 작업" 목록에 해당.
 */
export function summarizeVehicleOptions(
  trims: ReadonlyArray<{
    options: ReadonlyArray<{ name: string; category: string | null; isAccessory: boolean }>;
  }>
): VehicleOptionSummary[] {
  const byName = new Map<string, VehicleOptionSummary>();
  for (const trim of trims) {
    const seenInTrim = new Set<string>();
    for (const option of trim.options) {
      const name = normalizeOptionName(option.name);
      if (!name || seenInTrim.has(name)) continue;
      seenInTrim.add(name);
      const existing = byName.get(name);
      if (existing) {
        existing.trimCount += 1;
      } else {
        byName.set(name, {
          name,
          category: option.category,
          isAccessory: option.isAccessory,
          trimCount: 1,
        });
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "ko"));
}
