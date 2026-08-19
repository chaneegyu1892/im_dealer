import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  updateMany: vi.fn(),
  timingSafeEqualString: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedQuote: {
      count: mocks.count,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("@/lib/security", () => ({
  timingSafeEqualString: mocks.timingSafeEqualString,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import { GET, POST } from "./route";

const NOW_MS = Date.parse("2026-08-19T04:30:00.000Z");
const NOW = new Date(NOW_MS);

const EXPIRED_ACTIVE_WHERE = {
  expiresAt: { lte: NOW },
  deletedAt: null,
  status: { in: ["NEW", "CONTACTED", "IN_PROGRESS"] },
};

function request(authorization?: string): NextRequest {
  return new NextRequest("https://example.com/api/cron/expire-quotes", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("/api/cron/expire-quotes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.count.mockResolvedValue(4);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("인증 헤더가 없으면 401 — 집계를 시작하지 않는다", async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("시크릿 불일치는 timing-safe 비교 후 401", async () => {
    mocks.timingSafeEqualString.mockReturnValue(false);

    const response = await POST(request("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(mocks.timingSafeEqualString).toHaveBeenCalledWith("wrong", "cron-secret");
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("CRON_SECRET 미설정은 500(서버 오류 구성)", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("Vercel Cron 은 GET 으로 호출한다 — GET 도 동일 처리", async () => {
    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(mocks.count).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("만료 시각이 지난 미삭제 오픈 견적만 집계하고 expiredActiveCount 를 반환한다", async () => {
    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      expiredActiveCount: 4,
      at: NOW.toISOString(),
    });

    // 고객 410 SSOT 는 expiresAt. CONVERTED(계약 완료)는 집계에서 제외.
    expect(mocks.count).toHaveBeenCalledWith({
      where: EXPIRED_ACTIVE_WHERE,
    });
    const where = mocks.count.mock.calls[0]?.[0]?.where;
    expect(where.status.in).not.toContain("CONVERTED");
    expect(where.status.in).not.toContain("LOST");
  });

  it("이미 만료됐지만 LOST/CONVERTED 인 행은 count 0 — 재실행 멱등", async () => {
    mocks.count.mockResolvedValueOnce(0);

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      expiredActiveCount: 0,
    });
    expect(mocks.count).toHaveBeenCalledWith({
      where: EXPIRED_ACTIVE_WHERE,
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("handler 는 savedQuote.updateMany 를 호출하지 않는다", async () => {
    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.count).toHaveBeenCalledTimes(1);
  });

  it("DB 오류는 500 + Sentry 경보(무음 실패 방지)", async () => {
    mocks.count.mockRejectedValue(new Error("db down"));

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { cron: "expire-quotes" } })
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("vercel.json 에 경로가 등록돼 있고 기존 크론과 스케줄이 분산돼 있다", () => {
    const config = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons: { path: string; schedule: string }[] };

    const entry = config.crons.find((c) => c.path === "/api/cron/expire-quotes");
    expect(entry).toBeTruthy();
    expect(entry?.schedule).toMatch(/^(\S+ ){4}\S+$/);

    const schedules = config.crons.map((c) => c.schedule);
    expect(new Set(schedules).size).toBe(schedules.length);
  });
});
