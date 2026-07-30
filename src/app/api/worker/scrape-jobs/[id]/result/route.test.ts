import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapeJob: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
    financeCompany: { findUnique: vi.fn() },
    adminNotification: { create: vi.fn() },
  },
}));

import { POST } from "./route";

const CURRENT_LEASE = "25db3703-3c79-4b91-a138-b95cf86b4151";
const STALE_LEASE = "916fbf19-aea3-4e59-ae78-434cf60ac578";

function request(leaseToken = CURRENT_LEASE): NextRequest {
  return new NextRequest("http://localhost/api/worker/scrape-jobs/job-1/result", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scrape-job-lease-token": leaseToken,
    },
    body: JSON.stringify({ ok: false, error: "late failure" }),
  });
}

describe("POST /api/worker/scrape-jobs/[id]/result", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignores a late result after completion", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "completed",
      financeCompanyId: "fc-1",
      jobType: "catalog",
    });
    const response = await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(await response.json()).toEqual({ success: true, ignored: true });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a stale result after another worker has reclaimed the job", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "running",
      financeCompanyId: "fc-1",
      jobType: "catalog",
      leaseToken: CURRENT_LEASE,
    });
    mocks.updateMany.mockImplementation(({ where }) => Promise.resolve({
      count: where.leaseToken === undefined || where.leaseToken === CURRENT_LEASE ? 1 : 0,
    }));

    const response = await POST(request(STALE_LEASE), { params: Promise.resolve({ id: "job-1" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "작업 lease가 일치하지 않습니다." });
  });

  it("stores a result for the active lease", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "running",
      financeCompanyId: "fc-1",
      jobType: "catalog",
      leaseToken: CURRENT_LEASE,
    });
    mocks.updateMany.mockImplementation(({ where }) => Promise.resolve({
      count: where.leaseToken === CURRENT_LEASE ? 1 : 0,
    }));

    const response = await POST(request(), { params: Promise.resolve({ id: "job-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});
