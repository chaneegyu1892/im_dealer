import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  leaseUpdateMany: vi.fn(),
  catalogUpsert: vi.fn(),
}));
vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapeJob: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

const CURRENT_LEASE = "25db3703-3c79-4b91-a138-b95cf86b4151";
const STALE_LEASE = "916fbf19-aea3-4e59-ae78-434cf60ac578";

function request({
  financeCompanyId = "fc-input",
  weekOf = "2026-07-13",
  brandCd = "B",
  leaseToken = CURRENT_LEASE,
}: {
  financeCompanyId?: string;
  weekOf?: string;
  brandCd?: string;
  leaseToken?: string;
} = {}): NextRequest {
  return new NextRequest("http://localhost/api/worker/catalog/results", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-scrape-job-lease-token": leaseToken,
    },
    body: JSON.stringify({
      jobId: "job-1",
      financeCompanyId,
      productType: "장기렌트",
      weekOf,
      entries: [{
        brandCd,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.leaseUpdateMany.mockImplementation(({ where }) => Promise.resolve({
      count: where.leaseToken === CURRENT_LEASE ? 1 : 0,
    }));
    mocks.catalogUpsert.mockResolvedValue({ id: "catalog-1" });
    mocks.transaction.mockImplementation((callback) => callback({
      scrapeJob: { updateMany: mocks.leaseUpdateMany },
      capitalCatalogTrim: { upsert: mocks.catalogUpsert },
    }));
  });

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

  it.each([
    ["week", { weekOf: "2026-07-13", brandCd: "ALLOWED" }],
    ["brand", { weekOf: "2026-07-20", brandCd: "OUTSIDE" }],
  ])("rejects entries outside the %s scope claimed by the catalog job", async (_scope, overrides) => {
    mocks.findUnique.mockResolvedValue({
      status: "running",
      jobType: "catalog",
      financeCompanyId: "fc-input",
      productType: "장기렌트",
      leaseToken: CURRENT_LEASE,
      params: {
        mode: "catalog",
        productType: "장기렌트",
        weekOf: "2026-07-20",
        brands: [{ brandCd: "ALLOWED", name: "허용 브랜드" }],
      },
    });

    const response = await POST(request(overrides));

    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.catalogUpsert).not.toHaveBeenCalled();
  });

  it("stores a matching in-scope batch for the active lease", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "running",
      jobType: "catalog",
      financeCompanyId: "fc-input",
      productType: "장기렌트",
      params: {
        mode: "catalog",
        productType: "장기렌트",
        weekOf: "2026-07-20",
        brands: [{ brandCd: "ALLOWED", name: "허용 브랜드" }],
      },
    });

    const response = await POST(request({ weekOf: "2026-07-20", brandCd: "ALLOWED" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, upserted: 1 });
    expect(mocks.catalogUpsert).toHaveBeenCalledTimes(1);
  });

  it("rejects an in-scope batch from a stale lease before upsert", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "running",
      jobType: "catalog",
      financeCompanyId: "fc-input",
      productType: "장기렌트",
      params: {
        mode: "catalog",
        productType: "장기렌트",
        weekOf: "2026-07-20",
        brands: [{ brandCd: "ALLOWED", name: "허용 브랜드" }],
      },
    });

    const response = await POST(request({
      weekOf: "2026-07-20",
      brandCd: "ALLOWED",
      leaseToken: STALE_LEASE,
    }));

    expect(response.status).toBe(409);
    expect(mocks.catalogUpsert).not.toHaveBeenCalled();
  });
});
