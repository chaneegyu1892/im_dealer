import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    referral: {
      findMany: mocks.findMany,
      count: mocks.count,
      groupBy: mocks.groupBy,
    },
  },
}));

import { getAdminReferralPage } from "./referral";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "ref-1",
    code: "AB12CD",
    status: "REWARDED",
    createdAt: new Date("2026-08-01T09:00:00.000Z"),
    signupIpHash: "ip-hash-1",
    referrer: {
      id: "user-a",
      email: "referrer@example.com",
      name: "김추천",
      kakaoNickname: "추천닉",
    },
    referee: {
      id: "user-b",
      email: null,
      name: null,
      kakaoNickname: "피추천닉",
    },
    ...overrides,
  };
}

describe("getAdminReferralPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.groupBy.mockResolvedValue([]);
  });

  it("referrer/referee 를 관계 select 로 한 번에 조인해 목록을 내린다 (N+1 없음)", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([row()]);

    const page = await getAdminReferralPage({});

    expect(page.items).toHaveLength(1);
    // 목록 조회 select 에 referrer/referee 관계가 포함되어야 한다(행마다 재조회 금지).
    const select = mocks.findMany.mock.calls[0][0].select;
    expect(select.referrer).toBeDefined();
    expect(select.referee).toBeDefined();
  });

  it("페이지네이션 메타(total/totalPages) 를 계산하고 skip/take 를 전달한다", async () => {
    mocks.count.mockResolvedValue(45);

    await getAdminReferralPage({ page: "2" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: { createdAt: "desc" },
      })
    );
    const page = await getAdminReferralPage({ page: "2" });
    expect(page.total).toBe(45);
    expect(page.totalPages).toBe(3);
  });

  it("status 필터가 where 절에 반영된다", async () => {
    await getAdminReferralPage({ status: "BLOCKED" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "BLOCKED" }) })
    );
    expect(mocks.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "BLOCKED" }) })
    );
  });

  it("추천인/피추천인 식별자는 마스킹되어 원본 PII 가 내려가지 않는다", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([row()]);

    const page = await getAdminReferralPage({});

    const item = page.items[0];
    expect(item.referrer.masked).toBe("re******@example.com");
    expect(item.referee.masked).toContain("*");
    const serialized = JSON.stringify(page);
    expect(serialized).not.toContain("referrer@example.com");
    expect(serialized).not.toContain("김추천");
    expect(serialized).not.toContain("피추천닉");
  });

  it("email/name/kakaoNickname 이 모두 없으면 마스킹된 유저 id 로 식별한다", async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      row({
        referrer: { id: "clxxxuserida", email: null, name: null, kakaoNickname: null },
        referee: { id: "clxxxuseridb", email: null, name: null, kakaoNickname: null },
      }),
    ]);

    const page = await getAdminReferralPage({});

    expect(page.items[0].referrer.masked).toBe("clxxxus…");
  });

  it("상태별 카운트(REWARDED/BLOCKED/REVOKED) 를 groupBy 로 채운다", async () => {
    mocks.groupBy.mockResolvedValue([
      { status: "REWARDED", _count: { _all: 10 } },
      { status: "BLOCKED", _count: { _all: 2 } },
    ]);

    const page = await getAdminReferralPage({});

    expect(page.counts).toEqual({ REWARDED: 10, BLOCKED: 2, REVOKED: 0 });
  });
});
