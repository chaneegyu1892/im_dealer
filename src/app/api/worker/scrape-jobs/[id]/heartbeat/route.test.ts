import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  markWorkerSeen: vi.fn(),
  markNamedWorkerSeen: vi.fn(),
}));
vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/scraper/worker-presence", () => ({
  markWorkerSeen: mocks.markWorkerSeen,
  markNamedWorkerSeen: mocks.markNamedWorkerSeen,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { scrapeJob: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));

import { POST } from "./route";

const CURRENT_LEASE = "25db3703-3c79-4b91-a138-b95cf86b4151";
const STALE_LEASE = "916fbf19-aea3-4e59-ae78-434cf60ac578";

function request(leaseToken = CURRENT_LEASE): NextRequest {
  return new NextRequest("http://localhost/api/worker/scrape-jobs/job-1/heartbeat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scrape-job-lease-token": leaseToken,
    },
    body: JSON.stringify({ status: "running" }),
  });
}

describe("POST /api/worker/scrape-jobs/[id]/heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markWorkerSeen.mockResolvedValue(undefined);
    mocks.markNamedWorkerSeen.mockResolvedValue(undefined);
  });

  it("records the job's named-worker presence before responding", async () => {
    // 이 신호는 작업 생성 가드(온라인 판정)의 근거다. 응답 후로 밀리면
    // 서버리스에서 유실돼 실행 중인 PC 가 오프라인으로 오판된다.
    mocks.findUnique.mockResolvedValue({ status: "running", workerId: "hong", leaseToken: CURRENT_LEASE });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    let presenceSettled = false;
    mocks.markNamedWorkerSeen.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      presenceSettled = true;
    });

    await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(mocks.markNamedWorkerSeen).toHaveBeenCalledWith("hong");
    expect(presenceSettled).toBe(true);
  });

  it("skips named presence for a job without a worker name", async () => {
    mocks.findUnique.mockResolvedValue({ status: "completed", workerId: null });
    await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(mocks.markNamedWorkerSeen).not.toHaveBeenCalled();
  });

  it("does not mutate a completed job", async () => {
    mocks.findUnique.mockResolvedValue({ status: "completed" });
    const response = await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(await response.json()).toEqual({ status: "completed", ignored: true });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not overwrite a terminal state won by a concurrent request", async () => {
    mocks.findUnique
      .mockResolvedValueOnce({ status: "running" })
      .mockResolvedValueOnce({ status: "canceled" });
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const response = await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(await response.json()).toEqual({ status: "canceled", ignored: true });
  });

  it("rejects a stale heartbeat after another worker has reclaimed the job", async () => {
    mocks.findUnique.mockResolvedValue({ status: "running", leaseToken: CURRENT_LEASE });
    mocks.updateMany.mockImplementation(({ where }) => Promise.resolve({
      count: where.leaseToken === undefined || where.leaseToken === CURRENT_LEASE ? 1 : 0,
    }));

    const response = await POST(request(STALE_LEASE), { params: Promise.resolve({ id: "job-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "작업 lease가 일치하지 않습니다." });
  });

  it("updates heartbeat for the active lease", async () => {
    mocks.findUnique.mockResolvedValue({ status: "running", leaseToken: CURRENT_LEASE });
    mocks.updateMany.mockImplementation(({ where }) => Promise.resolve({
      count: where.leaseToken === CURRENT_LEASE ? 1 : 0,
    }));

    const response = await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "running" });
  });
});
