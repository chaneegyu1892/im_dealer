import type { DailyCount } from "@/types/admin";

// 어드민 지표의 날짜 경계는 서버 TZ(Vercel=UTC)와 무관하게 KST 기준으로 고정한다.
// 같은 규칙이 referral/attribution.ts 의 kstMonthRange 에도 적용되어 있다.
const KST_DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 임의 시각의 KST 캘린더 날짜 키 (YYYY-MM-DD) */
export function kstDateKey(d: Date): string {
  return KST_DATE_KEY_FORMATTER.format(d);
}

/** KST 기준 오늘 자정의 UTC 시각 */
export function kstDayStart(now: Date = new Date()): Date {
  const [y, m, d] = kstDateKey(now).split("-").map(Number);
  // KST = UTC+9 → KST 자정은 UTC 전날 15:00
  return new Date(Date.UTC(y, m - 1, d, -9));
}

/** KST 기준 이번 달 시작의 UTC 시각 */
export function kstMonthStart(now: Date = new Date()): Date {
  const [y, m] = kstDateKey(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1, -9));
}

/** KST 기준 monthsBack 개월 이전 달 시작의 UTC 시각 */
export function kstMonthsAgoStart(now: Date, monthsBack: number): Date {
  const [y, m] = kstDateKey(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1, -9));
}

export function fillDailyGaps(
  rows: { day: Date | string; count: bigint | number }[],
  _startDate: Date,
  days: number
): DailyCount[] {
  const dayMap = new Map<string, number>();
  for (const row of rows) {
    const key = typeof row.day === "string" ? row.day : kstDateKey(row.day);
    const value = typeof row.count === "bigint" ? Number(row.count) : row.count;
    dayMap.set(key, (dayMap.get(key) ?? 0) + value);
  }

  // 버킷은 항상 오늘(KST)로 끝난다. 과거 구현은 [N일 전 .. 어제]라 오늘 데이터가 조용히 누락됐다.
  const result: DailyCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = kstDateKey(new Date(Date.now() - i * 24 * 60 * 60 * 1000));
    result.push({ date: key, count: dayMap.get(key) ?? 0 });
  }
  return result;
}

export function aggregateMonthly(dates: Date[]): { month: string; count: number }[] {
  const monthMap = new Map<string, number>();
  for (const d of dates) {
    const key = kstDateKey(d).slice(0, 7);
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR");
}
