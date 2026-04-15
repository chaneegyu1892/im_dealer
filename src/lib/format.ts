// ─── 금액 포맷 ───────────────────────────────────────────
/** 원 단위 → "N만원" 포맷 (소수점 없이 반올림) */
export function formatKRWMan(amount: number): string {
  return `${Math.round(amount / 10000).toLocaleString()}만원`;
}

/** 정수 카운트 → 천단위 콤마 */
export function formatKRWCount(count: number): string {
  return count.toLocaleString();
}

// ─── 날짜 포맷 ───────────────────────────────────────────
/** ISO string 또는 Date → 한국어 날짜 (예: 2026. 4. 15.) */
export function formatDateKR(d: Date | string): string {
  return new Date(d).toLocaleDateString("ko-KR");
}

/** ISO string 또는 Date → 한국어 날짜시간 (예: 2026. 4. 15. 오후 3:00:00) */
export function formatDateTimeKR(d: Date | string): string {
  return new Date(d).toLocaleString("ko-KR");
}
