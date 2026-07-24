import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { WORKER_PROTOCOL_VERSION } from "@/lib/scraper/worker-version";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  financeCompanyFindUnique: vi.fn(),
  markWorkerSeen: vi.fn(),
}));

vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapeJob: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
    financeCompany: { findUnique: mocks.financeCompanyFindUnique },
  },
}));
vi.mock("@/lib/scraper/worker-presence", () => ({ markWorkerSeen: mocks.markWorkerSeen }));

import { POST } from "./route";

function claimRequest(workerProtocolVersion: string | null = String(WORKER_PROTOCOL_VERSION)) {
  const headers = new Headers();
  if (workerProtocolVersion !== null) {
    headers.set("x-worker-protocol-version", workerProtocolVersion);
  }
  return new NextRequest("http://localhost/api/worker/scrape-jobs/claim", {
    method: "POST",
    headers,
  });
}

describe("POST /api/worker/scrape-jobs/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markWorkerSeen.mockResolvedValue(undefined);
  });

  it("guides a headerless legacy worker to upgrade without allowing a claim", async () => {
    // Given a legacy claim request with no protocol version header
    const request = claimRequest(null);

    // When the worker requests a claim
    const response = await POST(request);

    // Then the legacy client can parse the upgrade version without touching the claim CAS
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      job: null,
      expectedWorkerVersion: WORKER_PROTOCOL_VERSION,
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an incompatible worker protocol version before querying for a claim", async () => {
    // Given a claim request from an incompatible worker
    const request = claimRequest(String(WORKER_PROTOCOL_VERSION - 1));

    // When the worker requests a claim
    const response = await POST(request);

    // Then compatibility is explained without touching the claim CAS
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "worker_protocol_version_incompatible",
      expectedWorkerVersion: WORKER_PROTOCOL_VERSION,
      receivedWorkerVersion: String(WORKER_PROTOCOL_VERSION - 1),
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("waits for worker presence to persist before returning a claim response", async () => {
    // Given a presence write that has not completed yet
    let finishPresence: (() => void) | undefined;
    mocks.markWorkerSeen.mockImplementation(
      () => new Promise<void>((resolve) => {
        finishPresence = resolve;
      })
    );
    mocks.findFirst.mockResolvedValue(null);

    // When the worker requests a claim
    const responsePromise = POST(claimRequest());
    const outcome = await Promise.race([
      responsePromise.then(() => "response-returned" as const),
      new Promise<"presence-pending">((resolve) => setImmediate(() => resolve("presence-pending"))),
    ]);
    finishPresence?.();
    const response = await responsePromise;

    // Then the route does not return until the presence write has settled
    expect(outcome).toBe("presence-pending");
    expect(response.status).toBe(200);
  });

  it("keeps claims available when worker presence persistence fails", async () => {
    // Given a Redis presence write that rejects
    mocks.markWorkerSeen.mockRejectedValue(new Error("Redis unavailable"));
    mocks.findFirst.mockResolvedValue(null);

    // When the worker requests a claim
    const response = await POST(claimRequest());

    // Then the optional presence failure does not fail the claim endpoint
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      job: null,
      expectedWorkerVersion: WORKER_PROTOCOL_VERSION,
    });
  });

  it("uses the stale cutoff in the compare-and-set for a reclaimed lease", async () => {
    mocks.findFirst.mockResolvedValue({ id: "job-1", status: "running" });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await POST(claimRequest());

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: "job-1",
        status: "running",
        heartbeatAt: { lt: expect.any(Date) },
      },
      data: {
        status: "running",
        claimedAt: expect.any(Date),
        heartbeatAt: expect.any(Date),
      },
    });
  });

  it("does not overwrite an admin cancellation while marking an invalid lease failed", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "job-1",
      status: "pending",
      financeCompanyId: "fc-1",
      credUsernameEnc: "encrypted-user",
      credPasswordEnc: "encrypted-pass",
    });
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    mocks.financeCompanyFindUnique.mockResolvedValue(null);

    await POST(claimRequest());

    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: "job-1",
        status: "running",
        claimedAt: expect.any(Date),
      },
      data: expect.objectContaining({ status: "failed" }),
    });
  });

  // 신한·우리금융·JB 는 키패드 때문에 어댑터가 자격증명을 쓰지 못한다.
  // 서버가 아예 저장하지 않으므로, 없다고 실패시키면 이 캐피탈사들이 통째로 막힌다.
  it("사람 로그인 캐피탈사는 자격증명이 없어도 작업을 내려준다", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "job-1",
      status: "pending",
      financeCompanyId: "fc-1",
      jobType: "catalog",
      productType: "장기렌트",
      params: { mode: "catalog" },
      credUsernameEnc: null,
      credPasswordEnc: null,
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.financeCompanyFindUnique.mockResolvedValue({ name: "신한카드" });

    const res = await POST(claimRequest());
    const body = await res.json();

    expect(body.job?.id).toBe("job-1");
    expect(body.credential.requiresHuman).toBe(true);
    expect(body.credential.usernameEnc).toBe("");
    // 실패 처리(2번째 updateMany)가 일어나지 않아야 한다
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });

  it("자동 로그인 캐피탈사는 자격증명이 없으면 실패 처리한다", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "job-1",
      status: "pending",
      financeCompanyId: "fc-1",
      credUsernameEnc: null,
      credPasswordEnc: null,
    });
    mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    mocks.financeCompanyFindUnique.mockResolvedValue({ name: "오릭스캐피탈" });

    const res = await POST(claimRequest());

    expect((await res.json()).job).toBeNull();
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({ status: "failed", error: "로그인 정보 없음" }),
    });
  });
});
