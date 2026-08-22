// ─── 금액 포맷 ───────────────────────────────────────────
/** 원 단위 → "N만원" 포맷 (소수점 없이 반올림) */
export function formatKRWMan(amount: number): string {
  return `${Math.round(amount / 10000).toLocaleString()}만원`;
}

/**
 * 원 단위 → "12만 4,000원" 포맷. 반올림하면 사라지는 자투리가 의미를 갖는
 * 자리(예산을 얼마나 아깝게 넘겼는지)에 쓴다.
 */
export function formatKRWManWon(amount: number): string {
  const man = Math.floor(amount / 10000);
  const won = amount % 10000;
  if (man === 0) return `${won.toLocaleString()}원`;
  if (won === 0) return `${man.toLocaleString()}만원`;
  return `${man.toLocaleString()}만 ${won.toLocaleString()}원`;
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
