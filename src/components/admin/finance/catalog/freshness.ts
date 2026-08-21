/**
 * 마지막 수집일의 신선도 표시 — 수집 화면과 카탈로그 열람이 같은 규칙을 쓴다.
 * 글자는 검게 유지하고 칸의 배경색으로 구분한다:
 * 1주 이내=초록 배경(신선) · 1달 이내=주황 배경(오래됨) · 1달 이상/미수집=빨강 배경(재수집 필요).
 */
export function freshness(iso: string | null): { label: string; bg: string; border: string } {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return { label: "미수집", bg: "bg-red-50 hover:bg-red-100", border: "border-red-200" };
  }
  const days = (Date.now() - d.getTime()) / 86_400_000;
  const label = `${d.getMonth() + 1}/${d.getDate()}`;
  if (days < 7) return { label, bg: "bg-emerald-50 hover:bg-emerald-100", border: "border-emerald-200" };
  if (days < 30) return { label, bg: "bg-amber-50 hover:bg-amber-100", border: "border-amber-200" };
  return { label, bg: "bg-red-50 hover:bg-red-100", border: "border-red-200" };
}

/** 색상 범례 — 배경색 견본과 구간 설명. */
export const FRESHNESS_LEGEND = [
  { label: "1주 이내", swatch: "bg-emerald-50 border-emerald-200" },
  { label: "1달 이내", swatch: "bg-amber-50 border-amber-200" },
  { label: "1달 이상 / 미수집", swatch: "bg-red-50 border-red-200" },
] as const;
