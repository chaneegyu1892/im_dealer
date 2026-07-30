import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), jobFindUnique: vi.fn() }));

vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapeJob: { findUnique: mocks.jobFindUnique },
    capitalCatalogTrim: { findMany: mocks.findMany },
  },
}));

import { GET } from "./route";

const CURRENT_LEASE = "25db3703-3c79-4b91-a138-b95cf86b4151";
const STALE_LEASE = "916fbf19-aea3-4e59-ae78-434cf60ac578";

function request(leaseToken = CURRENT_LEASE) {
  return new NextRequest(
    "http://localhost/api/worker/catalog/collected?jobId=job-1&financeCompanyId=fc-1&productType=장기렌트&weekOf=2026-07-20",
    { headers: { "x-scrape-job-lease-token": leaseToken } }
  );
}

async function collectedFrom(rows: { mdelCd: string; baseRates: unknown }[]) {
  mocks.findMany.mockResolvedValue(rows);
  const res = await GET(request());
  return (await res.json()).mdelCds as string[];
}

describe("GET /api/worker/catalog/collected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jobFindUnique.mockResolvedValue({
      status: "running",
      jobType: "catalog",
      financeCompanyId: "fc-1",
      productType: "장기렌트",
      leaseToken: CURRENT_LEASE,
      params: {
        mode: "catalog",
        productType: "장기렌트",
        weekOf: "2026-07-20",
        brands: [{ brandCd: "B-1", name: "브랜드" }],
      },
    });
  });

  it("회수율이 있는 모델만 수집됨으로 본다", async () => {
    const mdelCds = await collectedFrom([
      { mdelCd: "M-OK", baseRates: { "36_10000": 500_000 } },
      { mdelCd: "M-EMPTY", baseRates: { "36_10000": 0, "36_20000": 0 } },
    ]);

    expect(mdelCds).toEqual(["M-OK"]);
  });

  // 전 칸이 0 인 행을 수집됨으로 치면 같은 주 재수집에서 영구히 건너뛴다.
  it("전부 빈 모델은 목록에서 빼 다음 실행에서 재시도되게 한다", async () => {
    const mdelCds = await collectedFrom([
      { mdelCd: "M-EMPTY", baseRates: {} },
      { mdelCd: "M-NULL", baseRates: null },
    ]);

    expect(mdelCds).toEqual([]);
  });

  it("한 트림이라도 값이 있으면 그 모델은 수집됨", async () => {
    const mdelCds = await collectedFrom([
      { mdelCd: "M-1", baseRates: {} },
      { mdelCd: "M-1", baseRates: { "48_20000": 610_000 } },
    ]);

    expect(mdelCds).toEqual(["M-1"]);
  });

  it("weekOf 형식이 틀리면 400", async () => {
    const res = await GET(
      new NextRequest(
        "http://localhost/api/worker/catalog/collected?jobId=job-1&financeCompanyId=fc-1&productType=장기렌트&weekOf=2026-7-20",
        { headers: { "x-scrape-job-lease-token": CURRENT_LEASE } }
      )
    );
    expect(res.status).toBe(400);
  });

  it("stale lease는 다른 워커가 회수한 작업 범위를 조회하지 못한다", async () => {
    const res = await GET(request(STALE_LEASE));

    expect(res.status).toBe(409);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
