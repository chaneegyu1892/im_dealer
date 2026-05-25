/**
 * 어드민 화면 전반에 일관적으로 적용되는 제조사 정렬 규칙.
 *
 * - 운영 빈도가 높은 5개 브랜드(현대/기아/제네시스/BMW/벤츠)는 고정 우선 배치.
 * - 그 외 브랜드는 한국어 가나다순.
 *
 * DB 측은 `Brand.displayOrder`(1~5 + 1000)로 동일한 순서를 보장하지만,
 * 화면에서 `Vehicle`을 브랜드별로 그룹화할 때는 vehicle.displayOrder 정렬
 * 결과를 따라가게 되어 브랜드 우선순위가 깨질 수 있다. 이 비교 함수로
 * 그룹화 후 키를 정렬하여 화면 표시 순서를 일관되게 유지한다.
 */
export const BRAND_PRIORITY_ORDER = ["현대", "기아", "제네시스", "BMW", "벤츠"] as const;

export function compareBrandNames(a: string, b: string): number {
  const aIdx = BRAND_PRIORITY_ORDER.indexOf(a as (typeof BRAND_PRIORITY_ORDER)[number]);
  const bIdx = BRAND_PRIORITY_ORDER.indexOf(b as (typeof BRAND_PRIORITY_ORDER)[number]);

  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
  if (aIdx !== -1) return -1;
  if (bIdx !== -1) return 1;

  return a.localeCompare(b, "ko");
}
