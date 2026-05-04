import type { DailyCount } from "@/types/admin";

export function fillDailyGaps(
  rows: { day: Date; count: bigint | number }[],
  startDate: Date,
  days: number
): DailyCount[] {
  const dayMap = new Map<string, number>();
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10);
    const value = typeof row.count === "bigint" ? Number(row.count) : row.count;
    dayMap.set(key, (dayMap.get(key) ?? 0) + value);
  }

  const result: DailyCount[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: dayMap.get(key) ?? 0 });
  }
  return result;
}

export function aggregateMonthly(dates: Date[]): { month: string; count: number }[] {
  const monthMap = new Map<string, number>();
  for (const d of dates) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
