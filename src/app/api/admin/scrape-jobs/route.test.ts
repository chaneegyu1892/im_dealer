import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  financeCompanyFindUnique: vi.fn(),
  scrapeJobFindFirst: vi.fn(),
  scrapeJobCreate: vi.fn(),
  encryptString: vi.fn(),
  resolveCapitalConnection: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/lib/require-admin", () => ({
  requireRoleAtLeast: async () => ({
    admin: { id: "admin-1", email: "admin@example.com" },
    error: null,
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    financeCompany: { findUnique: mocks.financeCompanyFindUnique },
    scrapeJob: {
      findFirst: mocks.scrapeJobFindFirst,
      create: mocks.scrapeJobCreate,
    },
  },
}));
vi.mock("@/lib/pii", () => ({ encryptString: mocks.encryptString }));
vi.mock("@/lib/scraper/connections", () => ({
  resolveCapitalConnection: mocks.resolveCapitalConnection,
}));
vi.mock("@/lib/audit", () => ({ logAdminAction: mocks.audit }));

import { POST } from "./route";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/admin/scrape-jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/scrape-jobs credential retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T00:00:00.000Z"));
    vi.clearAllMocks();
    mocks.financeCompanyFindUnique.mockResolvedValue({ name: "오릭스캐피탈" });
    mocks.scrapeJobFindFirst.mockResolvedValue(null);
    mocks.scrapeJobCreate.mockImplementation(async ({ data }: { data: { id?: string; status: string } }) => ({
      id: data.id ?? "job-1",
      status: data.status,
    }));
    mocks.encryptString.mockImplementation((value: string) => `enc:${value}`);
    mocks.resolveCapitalConnection.mockReturnValue({
      adapter: "ORIX",
      loginUrl: "https://example.com/login",
      requiresHuman: false,
    });
    mocks.audit.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it("stores an expiry alongside automatic-login ciphertext", async () => {
    const response = await POST(
      request({
        jobType: "catalog",
        financeCompanyId: "fc-1",
        productType: "장기렌트",
        weekOf: "2026-07-27",
        brands: [{ brandCd: "CA100001", name: "현대" }],
        username: "operator",
        password: "secret",
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.scrapeJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "pending",
        credUsernameEnc: "enc:operator",
        credPasswordEnc: "enc:secret",
        credentialExpiresAt: new Date("2026-07-29T00:00:00.000Z"),
      }),
    });
  });

  it("does not create an expiry or ciphertext for human-login capital companies", async () => {
    mocks.financeCompanyFindUnique.mockResolvedValue({ name: "신한카드" });
    mocks.resolveCapitalConnection.mockReturnValue({
      adapter: "SHINHAN",
      loginUrl: "https://example.com/login",
      requiresHuman: true,
    });

    const response = await POST(
      request({
        jobType: "catalog",
        financeCompanyId: "fc-1",
        productType: "장기렌트",
        weekOf: "2026-07-27",
        brands: [{ brandCd: "CA100001", name: "현대" }],
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.scrapeJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        credUsernameEnc: null,
        credPasswordEnc: null,
        credentialExpiresAt: null,
      }),
    });
    expect(mocks.encryptString).not.toHaveBeenCalled();
  });

  it("pins the job to the collection PC the tester named", async () => {
    const response = await POST(
      request({
        jobType: "catalog",
        financeCompanyId: "fc-1",
        productType: "장기렌트",
        weekOf: "2026-07-27",
        brands: [{ brandCd: "CA100001", name: "현대" }],
        username: "operator",
        password: "secret",
        workerId: "hong",
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.scrapeJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ workerId: "hong" }),
    });
  });

  it("scopes the in-flight guard per collection PC so testers do not block each other", async () => {
    // Given another tester already collecting from the same capital company on their own PC
    await POST(
      request({
        jobType: "catalog",
        financeCompanyId: "fc-1",
        productType: "장기렌트",
        weekOf: "2026-07-27",
        brands: [{ brandCd: "CA100001", name: "현대" }],
        username: "operator",
        password: "secret",
        workerId: "kim",
      })
    );

    // Then the duplicate-session guard only looks at that same PC's jobs — 'kim' running
    // ORIX does not make 'hong' wait, because each tester uses their own capital account.
    expect(mocks.scrapeJobFindFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ financeCompanyId: "fc-1", workerId: "kim" }),
    });
  });

  it("rejects a collection PC name that could not have come from a worker", async () => {
    const response = await POST(
      request({
        jobType: "catalog",
        financeCompanyId: "fc-1",
        productType: "장기렌트",
        weekOf: "2026-07-27",
        brands: [{ brandCd: "CA100001", name: "현대" }],
        username: "operator",
        password: "secret",
        workerId: "hong drop table",
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.scrapeJobCreate).not.toHaveBeenCalled();
  });
});
