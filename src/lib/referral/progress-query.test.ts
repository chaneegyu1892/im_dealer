import { describe, expect, it, vi } from "vitest";
import { loadReferralProgressItems } from "./progress-query";

interface FakeReferralRow {
  id: string;
  createdAt: Date;
  referee: {
    name: string;
    supabaseId: string | null;
    profileCompletedAt?: Date | null;
  };
}

interface FakeQuoteRow {
  userId: string | null;
  status: string;
  contactedAt: Date | null;
}

function fakeDb(referrals: FakeReferralRow[], quotes: FakeQuoteRow[]) {
  return {
    referral: { findMany: vi.fn().mockResolvedValue(referrals) },
    savedQuote: { findMany: vi.fn().mockResolvedValue(quotes) },
  };
}

describe("loadReferralProgressItems", () => {
  it("견적을 referee.supabaseId 로 매칭한다 (Prisma User.id 아님)", async () => {
    const db = fakeDb(
      [
        {
          id: "ref-1",
          createdAt: new Date("2026-08-10T00:00:00Z"),
          referee: { name: "김진규", supabaseId: "sb-uuid-1" },
        },
      ],
      [{ userId: "sb-uuid-1", status: "CONTACTED", contactedAt: new Date() }],
    );

    const items = await loadReferralProgressItems("referrer-1", db as never);

    expect(db.savedQuote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: { in: ["sb-uuid-1"] } }),
      }),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.step).toBe(3);
  });

  it("supabaseId 가 없는 referee 는 견적 조회 없이 1단계로 둔다", async () => {
    const db = fakeDb(
      [
        {
          id: "ref-1",
          createdAt: new Date("2026-08-10T00:00:00Z"),
          referee: { name: "탈퇴 회원", supabaseId: null },
        },
      ],
      [],
    );

    const items = await loadReferralProgressItems("referrer-1", db as never);

    expect(db.savedQuote.findMany).not.toHaveBeenCalled();
    expect(items[0]?.step).toBe(1);
  });

  it("여러 referee 의 견적을 각자에게 배분한다", async () => {
    const db = fakeDb(
      [
        {
          id: "ref-1",
          createdAt: new Date("2026-08-01T00:00:00Z"),
          referee: { name: "김계약", supabaseId: "sb-a" },
        },
        {
          id: "ref-2",
          createdAt: new Date("2026-08-05T00:00:00Z"),
          referee: { name: "이가입", supabaseId: "sb-b" },
        },
      ],
      [
        { userId: "sb-a", status: "CONVERTED", contactedAt: new Date() },
        { userId: "sb-a", status: "NEW", contactedAt: null },
      ],
    );

    const items = await loadReferralProgressItems("referrer-1", db as never);

    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("ref-1")?.step).toBe(4);
    expect(byId.get("ref-2")?.step).toBe(1);
  });

  it("가입일 라벨은 referee 의 실제 가입 완료 시각을 우선한다", async () => {
    const db = fakeDb(
      [
        {
          id: "ref-1",
          // 사후 코드 입력으로 인정 시점이 가입보다 5일 늦은 케이스
          createdAt: new Date("2026-08-15T03:00:00Z"),
          referee: {
            name: "김진규",
            supabaseId: "sb-1",
            profileCompletedAt: new Date("2026-08-10T03:00:00Z"),
          },
        },
      ],
      [],
    );

    const items = await loadReferralProgressItems("referrer-1", db as never);

    expect(items[0]?.signedUpLabel).toBe("2026.08.10");
  });

  it("가입 완료 시각이 없으면(백필 전 데이터) 인정 시점으로 대체한다", async () => {
    const db = fakeDb(
      [
        {
          id: "ref-1",
          createdAt: new Date("2026-08-15T03:00:00Z"),
          referee: { name: "김진규", supabaseId: "sb-1", profileCompletedAt: null },
        },
      ],
      [],
    );

    const items = await loadReferralProgressItems("referrer-1", db as never);

    expect(items[0]?.signedUpLabel).toBe("2026.08.15");
  });

  it("referrer 기준 REWARDED 추천만 최신순으로 조회한다", async () => {
    const db = fakeDb([], []);

    await loadReferralProgressItems("referrer-9", db as never);

    expect(db.referral.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { referrerId: "referrer-9", status: "REWARDED" },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});
