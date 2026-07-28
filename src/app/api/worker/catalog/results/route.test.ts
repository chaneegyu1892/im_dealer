import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapeJob: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

function request(): NextRequest {
  return new NextRequest("http://localhost/api/worker/catalog/results", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: "job-1",
      financeCompanyId: "fc-input",
      productType: "장기렌트",
      weekOf: "2026-07-13",
      entries: [{
        brandCd: "B",
        brandName: "브랜드",
        modelCd: "M",
        modelName: "모델",
        dtMdlCd: "D",
        mdelCd: "T",
        trimName: "트림",
        vehiclePrice: 40_000_000,
        baseRates: { "36_10000": 500_000 },
        warnings: [],
      }],
    }),
  });
}

describe("POST /api/worker/catalog/results", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a batch whose company does not match the running catalog job", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "running",
      jobType: "catalog",
      financeCompanyId: "fc-job",
      productType: "장기렌트",
    });
    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
