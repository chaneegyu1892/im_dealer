import { describe, expect, it } from "vitest";
import {
  aggregateMonthly,
  fillDailyGaps,
  kstDateKey,
  kstDayStart,
  kstMonthStart,
  kstMonthsAgoStart,
} from "./shared";

// KST = UTC+9. 경계 검증용 시각: UTC 2026-08-21T15:30:00Z == KST 2026-08-22 00:30
const boundaryInstant = new Date("2026-08-21T15:30:00.000Z");

describe("kstDateKey", () => {
  it("UTC 자정 직후는 전날 KST 날짜로 읽힌다", () => {
    expect(kstDateKey(new Date("2026-08-21T00:30:00.000Z"))).toBe("2026-08-21");
  });

  it("KST 날짜가 바뀌는 순간(UTC 15:00)부터 다음 날 키가 된다", () => {
    expect(kstDateKey(boundaryInstant)).toBe("2026-08-22");
  });
});

describe("kstDayStart", () => {
  it("주어진 시각이 속한 KST 날의 자정(UTC 15:00)을 반환한다", () => {
    expect(kstDayStart(boundaryInstant).toISOString()).toBe("2026-08-21T15:00:00.000Z");
  });
});

describe("kstMonthStart", () => {
  it("KST 기준 월 시작 자정을 반환한다", () => {
    // KST 2026-08-22 00:30 → 8월 1일 자정 = UTC 2026-07-31T15:00
    expect(kstMonthStart(boundaryInstant).toISOString()).toBe("2026-07-31T15:00:00.000Z");
  });
});

describe("kstMonthsAgoStart", () => {
  it("KST 기준 N개월 이전 달 시작을 반환하고 연도를 넘겨도 안전하다", () => {
    const feb = new Date("2026-02-10T05:00:00.000Z");
    expect(kstMonthsAgoStart(feb, 6).toISOString()).toBe("2025-07-31T15:00:00.000Z");
  });
});

describe("fillDailyGaps", () => {
  it("마지막 버킷이 오늘(KST)이고 오늘 데이터를 누락하지 않는다", () => {
    const todayKey = kstDateKey(new Date());
    const yesterdayKey = kstDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const rows = [
      { day: todayKey, count: BigInt(3) },
      { day: yesterdayKey, count: 2 },
    ];
    const result = fillDailyGaps(rows, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 3);
    expect(result).toHaveLength(3);
    expect(result.at(-1)).toEqual({ date: todayKey, count: 3 });
    expect(result.at(-2)).toEqual({ date: yesterdayKey, count: 2 });
    expect(result[0].count).toBe(0);
  });
});

describe("aggregateMonthly", () => {
  it("월 키를 KST 기준으로 계산한다", () => {
    // UTC 7/31 15:30 == KST 8/1 → 8월로 집계되어야 한다
    const months = aggregateMonthly([new Date("2026-07-31T15:30:00.000Z")]);
    expect(months).toEqual([{ month: "2026-08", count: 1 }]);
  });
});
