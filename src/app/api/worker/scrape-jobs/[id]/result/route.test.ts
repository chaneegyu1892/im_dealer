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

function request(): NextRequest {
  return new NextRequest("http://localhost/api/worker/scrape-jobs/job-1/result", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
});
