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
});
