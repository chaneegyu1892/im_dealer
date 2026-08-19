import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  timingSafeEqualString: vi.fn(),
  alimtalkUpdateMany: vi.fn(),
  deliveryUpdateMany: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    alimtalkMessage: { updateMany: mocks.alimtalkUpdateMany },
    quoteDelivery: { updateMany: mocks.deliveryUpdateMany },
  },
}));
vi.mock("@/lib/security", () => ({
  timingSafeEqualString: mocks.timingSafeEqualString,
}));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));

import { GET, POST } from "./route";

// 스윕 컷오프 계산이 결정적이어야 한다(오탐 방지 검증이므로).
const NOW_MS = Date.parse("2026-08-19T05:30:00.000Z");
const NOW = new Date(NOW_MS);
const LEASE_STALE_CUTOFF = new Date(NOW_MS - 10 * 60 * 1000); // ALIMTALK_LEASE_STALE_MS
const ACCEPTED_CUTOFF = new Date(NOW_MS - 25 * 60 * 60 * 1000); // 결과큐 24h 보관 + 1h 여유
const DELIVERY_CUTOFF = new Date(NOW_MS - 5 * 60 * 1000); // deliver maxDuration=30s 의 10배

function request(authorization?: string): NextRequest {
  return new NextRequest("https://example.com/api/cron/outbound-sweep", {
    headers: authorization ? { authorization } : undefined,
  });
}

describe("/api/cron/outbound-sweep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    mocks.timingSafeEqualString.mockReturnValue(true);
    mocks.alimtalkUpdateMany
      .mockResolvedValueOnce({ count: 2 }) // 데드레터
      .mockResolvedValueOnce({ count: 1 }); // stale ACCEPTED
    mocks.deliveryUpdateMany.mockResolvedValue({ count: 4 }); // delivery 좀비
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("인증 헤더가 없으면 401 — 상태 전이를 시작하지 않는다", async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.alimtalkUpdateMany).not.toHaveBeenCalled();
    expect(mocks.deliveryUpdateMany).not.toHaveBeenCalled();
  });

  it("시크릿 불일치는 timing-safe 비교 후 401", async () => {
    mocks.timingSafeEqualString.mockReturnValue(false);

    const response = await POST(request("Bearer wrong"));

    expect(response.status).toBe(401);
    expect(mocks.timingSafeEqualString).toHaveBeenCalledWith("wrong", "cron-secret");
    expect(mocks.alimtalkUpdateMany).not.toHaveBeenCalled();
  });

  it("CRON_SECRET 미설정은 500(서버 오류 구성)", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    expect(mocks.alimtalkUpdateMany).not.toHaveBeenCalled();
  });

  it("Vercel Cron 은 GET 으로 호출한다 — GET 도 동일 처리", async () => {
    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(mocks.alimtalkUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("데드레터: attempts 3 이상 PENDING·리스 끊긴 SENDING 만 FAILED 로", async () => {
    await POST(request("Bearer cron-secret"));

    expect(mocks.alimtalkUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        attempts: { gte: 3 },
        OR: [
          { status: "PENDING" },
          { status: "SENDING", claimedAt: { lt: LEASE_STALE_CUTOFF } },
        ],
      },
      data: {
        status: "FAILED",
        failReason: expect.stringContaining("재시도 한도"),
        leaseToken: null,
        resultAt: NOW,
      },
    });
  });

  it("stale ACCEPTED: 접수 25시간 무결과면 FAILED 확정 + resultAt 로 종결", async () => {
    await POST(request("Bearer cron-secret"));

    expect(mocks.alimtalkUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { status: "ACCEPTED", sentAt: { lt: ACCEPTED_CUTOFF } },
      data: {
        status: "FAILED",
        failReason: expect.stringContaining("미수신"),
        resultAt: NOW,
      },
    });
  });

  it("delivery 좀비: maxDuration(30초) 초과 잔류 PENDING QuoteDelivery → FAILED+사유", async () => {
    await POST(request("Bearer cron-secret"));

    expect(mocks.deliveryUpdateMany).toHaveBeenCalledWith({
      where: { status: "PENDING", createdAt: { lt: DELIVERY_CUTOFF } },
      data: {
        status: "FAILED",
        failReason: expect.stringContaining("중단"),
      },
    });
  });

  it("완료 응답에 카운트와 컷오프를 내려준다(운영 가시성)", async () => {
    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      deadLettered: 2,
      staleAcceptedFinalized: 1,
      deliveryZombiesFailed: 4,
      leaseStaleCutoff: LEASE_STALE_CUTOFF.toISOString(),
      acceptedCutoff: ACCEPTED_CUTOFF.toISOString(),
      deliveryCutoff: DELIVERY_CUTOFF.toISOString(),
    });
  });

  it("스윕은 상태 정리만 한다 — 재발송 큐잉(attempts 리셋·PENDING/SENDING 회귀) 없음", async () => {
    await POST(request("Bearer cron-secret"));

    // 알림톡 updateMany 는 데드레터·ACCEPTED 확정 두 번뿐(신규 발송 큐 생성 호출 없음)
    expect(mocks.alimtalkUpdateMany).toHaveBeenCalledTimes(2);
    expect(mocks.deliveryUpdateMany).toHaveBeenCalledTimes(1);
    for (const call of mocks.alimtalkUpdateMany.mock.calls) {
      expect(call[0].data.status).toBe("FAILED");
      expect(call[0].data.attempts).toBeUndefined();
    }
    expect(mocks.deliveryUpdateMany.mock.calls[0][0].data.status).toBe("FAILED");
  });

  it("DB 오류는 500 + Sentry 경보(무음 실패 방지)", async () => {
    mocks.alimtalkUpdateMany.mockReset();
    mocks.alimtalkUpdateMany.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await POST(request("Bearer cron-secret"));

    expect(response.status).toBe(500);
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { cron: "outbound-sweep" } })
    );
  });

  it("vercel.json 에 경로가 등록돼 있고 기존 크론과 스케줄이 분산돼 있다", () => {
    const config = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
    ) as { crons: { path: string; schedule: string }[] };

    const entry = config.crons.find((c) => c.path === "/api/cron/outbound-sweep");
    expect(entry).toBeTruthy();
    expect(entry?.schedule).toMatch(/^(\S+ ){4}\S+$/); // 5필드 cron 식

    const schedules = config.crons.map((c) => c.schedule);
    expect(new Set(schedules).size).toBe(schedules.length);
  });
});
