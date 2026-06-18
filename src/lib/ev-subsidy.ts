// 전기차 보조금(안내용) 범위 계산·포맷 유틸.
// ⚠️ 보조금은 트림(Trim) 단위로 관리되며 견적 계산에는 절대 반영하지 않는다(표시 전용).
//    목록 카드처럼 트림이 선택되지 않은 화면에서는 노출 트림들의 보조금 최소~최대 범위를 보여준다.

export interface SubsidyRange {
  /** 최소 보조금(원) */
  min: number;
  /** 최대 보조금(원) */
  max: number;
}

/**
 * 노출 트림들의 evSubsidy(원) 중 양수만 모아 최소/최대 범위를 산출한다.
 * 양수 보조금이 하나도 없으면 null.
 */
export function subsidyRangeFromTrims(
  trims: ReadonlyArray<{ evSubsidy: number | null }>
): SubsidyRange | null {
  const values = trims
    .map((t) => t.evSubsidy)
    .filter((v): v is number => v != null && v > 0);
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** 보조금 범위를 "480만원"(단일) 또는 "480만~720만원"(범위)으로 포맷한다. */
export function formatSubsidyManwon(range: SubsidyRange): string {
  const toManwon = (won: number) => Math.round(won / 10000).toLocaleString();
  return range.min === range.max
    ? `${toManwon(range.max)}만원`
    : `${toManwon(range.min)}만~${toManwon(range.max)}만원`;
}
