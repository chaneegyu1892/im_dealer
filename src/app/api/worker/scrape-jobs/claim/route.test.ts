import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  financeCompanyFindUnique: vi.fn(),
}));

vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapeJob: { findFirst: mocks.findFirst, updateMany: mocks.updateMany },
    financeCompany: { findUnique: mocks.financeCompanyFindUnique },
  },
}));

import { POST } from "./route";

describe("POST /api/worker/scrape-jobs/claim", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the stale cutoff in the compare-and-set for a reclaimed lease", async () => {
    mocks.findFirst.mockResolvedValue({ id: "job-1", status: "running" });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await POST(new NextRequest("http://localhost/api/worker/scrape-jobs/claim", { method: "POST" }));

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

    await POST(new NextRequest("http://localhost/api/worker/scrape-jobs/claim", { method: "POST" }));

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

    const res = await POST(
      new NextRequest("http://localhost/api/worker/scrape-jobs/claim", { method: "POST" })
    );
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

    const res = await POST(
      new NextRequest("http://localhost/api/worker/scrape-jobs/claim", { method: "POST" })
    );

    expect((await res.json()).job).toBeNull();
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: expect.anything(),
      data: expect.objectContaining({ status: "failed", error: "로그인 정보 없음" }),
    });
  });
});
