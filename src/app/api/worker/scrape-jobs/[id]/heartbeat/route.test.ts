import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { scrapeJob: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } },
}));

import { POST } from "./route";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/worker/scrape-jobs/job-1/heartbeat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "running" }),
  });
}

describe("POST /api/worker/scrape-jobs/[id]/heartbeat", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
