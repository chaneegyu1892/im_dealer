import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/worker-auth", () => ({ requireWorker: () => ({ error: null }) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { capitalCatalogTrim: { findMany: mocks.findMany } },
}));

import { GET } from "./route";

function request() {
  return new NextRequest(
    "http://localhost/api/worker/catalog/collected?financeCompanyId=fc-1&productType=장기렌트&weekOf=2026-07-20"
  );
}

async function collectedFrom(rows: { mdelCd: string; baseRates: unknown }[]) {
  mocks.findMany.mockResolvedValue(rows);
  const res = await GET(request());
  return (await res.json()).mdelCds as string[];
}

describe("GET /api/worker/catalog/collected", () => {
  beforeEach(() => vi.clearAllMocks());

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
        "http://localhost/api/worker/catalog/collected?financeCompanyId=fc-1&productType=장기렌트&weekOf=2026-7-20"
      )
    );
    expect(res.status).toBe(400);
  });
});
