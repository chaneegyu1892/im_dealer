import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attributeReferral,
  IP_SIGNUP_THRESHOLD,
  MONTHLY_REWARD_CAP,
  type ReferralDb,
} from "./attribute";

const NOW = new Date("2026-08-11T04:00:00.000Z");

const REFERRER = {
  id: "user-referrer",
  isActive: true,
  kakaoId: "kakao-1",
  phone: "010-1111-2222",
  email: "referrer@example.com",
  supabaseId: "sb-referrer",
};

const REFEREE = {
  id: "user-referee",
  kakaoId: "kakao-2",
  phone: "010-3333-4444",
  email: "referee@example.com",
  supabaseId: "sb-referee",
};

const POLICIES = [
  {
    id: "policy-given",
    trigger: "REFERRAL_GIVEN",
    title: "친구 추천 감사 캐시백",
    rewardLabel: "5만원 캐시백",
    rewardAmount: 50_000,
    validDays: 180,
  },
  {
    id: "policy-received",
    trigger: "REFERRAL_RECEIVED",
    title: "추천 가입 축하 캐시백",
    rewardLabel: "3만원 캐시백",
    rewardAmount: 30_000,
    validDays: 180,
  },
];

function uniqueViolation() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function createDb() {
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue(REFERRER) },
    referral: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: { status: string } }) => ({
        id: `referral-${data.status.toLowerCase()}`,
      })),
    },
    couponPolicy: { findMany: vi.fn().mockResolvedValue(POLICIES) },
    issuedCoupon: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
  };
  return db;
}

type TestDb = ReturnType<typeof createDb>;

function run(db: TestDb, overrides: Partial<Parameters<typeof attributeReferral>[0]> = {}) {
  return attributeReferral({
    db: db as unknown as ReferralDb,
    refereeUser: REFEREE,
    referralCode: "A1234",
    ipHash: "hash-abc",
    now: NOW,
    ...overrides,
  });
}

describe("attributeReferral", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createDb();
  });

  it("정상 추천이면 REWARDED 1행 + HELD 쿠폰 2장을 만든다", async () => {
    const result = await run(db);

    expect(result).toEqual({ status: "REWARDED", referralId: "referral-rewarded" });

    expect(db.referral.create).toHaveBeenCalledTimes(1);
    expect(db.referral.create.mock.calls[0][0]).toEqual({
      data: {
        referrerId: "user-referrer",
        refereeId: "user-referee",
        code: "A1234",
        status: "REWARDED",
        signupIpHash: "hash-abc",
      },
      select: { id: true },
    });

    expect(db.issuedCoupon.createMany).toHaveBeenCalledTimes(1);
    const payload = db.issuedCoupon.createMany.mock.calls[0][0];
    const expiresAt = new Date(NOW.getTime() + 180 * 24 * 60 * 60 * 1000);

    expect(payload.data).toHaveLength(2);
    expect(payload.data[0]).toMatchObject({
      userId: "user-referrer",
      policyId: "policy-given",
      status: "HELD",
      titleSnapshot: "친구 추천 감사 캐시백",
      rewardLabelSnapshot: "5만원 캐시백",
      rewardAmountSnapshot: 50_000,
      referralId: "referral-rewarded",
      expiresAt,
    });
    expect(payload.data[1]).toMatchObject({
      userId: "user-referee",
      policyId: "policy-received",
      status: "HELD",
      rewardAmountSnapshot: 30_000,
      referralId: "referral-rewarded",
      expiresAt,
    });
    expect(payload.data[0].code).toMatch(/^AD-[A-Z2-9]{6}$/);
    expect(payload.data[1].code).toMatch(/^AD-[A-Z2-9]{6}$/);
  });

  it("소문자·공백이 섞인 코드도 정규화해 조회한다", async () => {
    await run(db, { referralCode: " a1234 " });

    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referralCode: "A1234" } })
    );
  });

  it("코드 형식이 깨졌으면 DB 를 건드리지 않고 SKIPPED", async () => {
    const result = await run(db, { referralCode: "not-a-code" });

    expect(result).toEqual({ status: "SKIPPED", reason: "invalid_code" });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.referral.create).not.toHaveBeenCalled();
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("없는 코드면 SKIPPED, 행도 쿠폰도 없다", async () => {
    db.user.findUnique.mockResolvedValue(null);

    const result = await run(db);

    expect(result).toEqual({ status: "SKIPPED", reason: "referrer_not_found" });
    expect(db.referral.create).not.toHaveBeenCalled();
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("비활성 추천인이면 SKIPPED, 행도 쿠폰도 없다", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, isActive: false });

    const result = await run(db);

    expect(result).toEqual({ status: "SKIPPED", reason: "referrer_inactive" });
    expect(db.referral.create).not.toHaveBeenCalled();
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("같은 User.id 면 자기추천으로 BLOCKED, 쿠폰 0장", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, id: REFEREE.id });

    const result = await run(db);

    expect(result).toMatchObject({ status: "BLOCKED", reason: "self_referral" });
    expect(db.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "BLOCKED" }) })
    );
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("kakaoId 가 같으면 다른 계정이라도 BLOCKED", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, kakaoId: REFEREE.kakaoId });

    const result = await run(db);

    expect(result).toMatchObject({ status: "BLOCKED", reason: "self_referral" });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("supabaseId 가 같으면 BLOCKED", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, supabaseId: REFEREE.supabaseId });

    await expect(run(db)).resolves.toMatchObject({
      status: "BLOCKED",
      reason: "self_referral",
    });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("대소문자만 다른 이메일도 같은 사람으로 보고 BLOCKED", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, email: "REFEREE@Example.com " });

    await expect(run(db)).resolves.toMatchObject({
      status: "BLOCKED",
      reason: "self_referral",
    });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("포맷이 다른 동일 전화번호(+82/하이픈)는 정규화 후 BLOCKED", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, phone: "+82 10-3333-4444" });

    await expect(run(db)).resolves.toMatchObject({
      status: "BLOCKED",
      reason: "self_referral",
    });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("전화번호가 둘 다 없으면 자기추천으로 오판하지 않는다", async () => {
    db.user.findUnique.mockResolvedValue({
      ...REFERRER,
      phone: null,
      email: null,
      kakaoId: null,
      supabaseId: null,
    });

    await expect(
      run(db, { refereeUser: { id: REFEREE.id, phone: null, email: null } })
    ).resolves.toMatchObject({ status: "REWARDED" });
  });

  it("이번 달 보상이 한도에 도달하면 BLOCKED, 쿠폰 0장", async () => {
    db.referral.count.mockResolvedValueOnce(MONTHLY_REWARD_CAP);

    const result = await run(db);

    expect(result).toMatchObject({ status: "BLOCKED", reason: "monthly_cap" });
    expect(db.referral.count.mock.calls[0][0]).toEqual({
      where: {
        referrerId: "user-referrer",
        status: "REWARDED",
        createdAt: { gte: new Date(NOW.getFullYear(), NOW.getMonth(), 1, 0, 0, 0, 0) },
      },
    });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("한도 직전(9건)이면 보상한다", async () => {
    db.referral.count.mockResolvedValueOnce(MONTHLY_REWARD_CAP - 1).mockResolvedValueOnce(0);

    await expect(run(db)).resolves.toMatchObject({ status: "REWARDED" });
    expect(db.issuedCoupon.createMany).toHaveBeenCalledTimes(1);
  });

  it("같은 IP 해시로 24시간 안에 임계치만큼 가입했으면 BLOCKED", async () => {
    db.referral.count.mockResolvedValueOnce(0).mockResolvedValueOnce(IP_SIGNUP_THRESHOLD);

    const result = await run(db);

    expect(result).toMatchObject({ status: "BLOCKED", reason: "ip_threshold" });
    expect(db.referral.count.mock.calls[1][0]).toEqual({
      where: {
        signupIpHash: "hash-abc",
        createdAt: { gte: new Date(NOW.getTime() - 24 * 60 * 60 * 1000) },
      },
    });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("ipHash 가 없으면 IP 조회 자체를 하지 않는다", async () => {
    await expect(run(db, { ipHash: null })).resolves.toMatchObject({ status: "REWARDED" });

    expect(db.referral.count).toHaveBeenCalledTimes(1);
    expect(db.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ signupIpHash: null }) })
    );
  });

  it("이미 귀속된 피추천인이면 create 를 시도조차 하지 않고 SKIPPED", async () => {
    // Postgres 는 트랜잭션 안에서 유일 제약이 깨지면 트랜잭션 전체를 abort 시킨다.
    // 흔한 경로에서 제약을 건드리면 안 되므로 사전 조회로 걸러야 한다.
    db.referral.findUnique.mockResolvedValue({ id: "referral-existing" });

    const result = await run(db);

    expect(result).toEqual({ status: "SKIPPED", reason: "already_attributed" });
    expect(db.referral.findUnique).toHaveBeenCalledWith({
      where: { refereeId: "user-referee" },
      select: { id: true },
    });
    expect(db.referral.create).not.toHaveBeenCalled();
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("경합으로 P2002 가 나면 SKIPPED — 쿠폰을 또 만들지 않는다", async () => {
    db.referral.create.mockRejectedValue(uniqueViolation());

    const result = await run(db);

    expect(result).toEqual({ status: "SKIPPED", reason: "already_attributed" });
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("BLOCKED 기록도 이미 귀속돼 있으면 SKIPPED 로 떨어진다", async () => {
    db.user.findUnique.mockResolvedValue({ ...REFERRER, id: REFEREE.id });
    db.referral.findUnique.mockResolvedValue({ id: "referral-existing" });

    await expect(run(db)).resolves.toEqual({
      status: "SKIPPED",
      reason: "already_attributed",
    });
    expect(db.referral.create).not.toHaveBeenCalled();
    expect(db.issuedCoupon.createMany).not.toHaveBeenCalled();
  });

  it("P2002 가 아닌 DB 오류는 삼키지 않고 던진다", async () => {
    db.referral.create.mockRejectedValue(new Error("connection lost"));

    await expect(run(db)).rejects.toThrow("connection lost");
  });

  it("활성 정책이 하나뿐이면 그 한 장만 발급하고 policy_missing 을 알린다", async () => {
    db.couponPolicy.findMany.mockResolvedValue([POLICIES[0]]);

    const result = await run(db);

    expect(result).toMatchObject({ status: "REWARDED", reason: "policy_missing" });
    expect(db.issuedCoupon.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("validDays 가 없는 정책은 만료 없이 발급한다", async () => {
    db.couponPolicy.findMany.mockResolvedValue([{ ...POLICIES[0], validDays: null }]);

    await run(db);

    expect(db.issuedCoupon.createMany.mock.calls[0][0].data[0].expiresAt).toBeNull();
  });

  it("결과에 원문 PII 를 담지 않는다", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    db.user.findUnique.mockResolvedValue({ ...REFERRER, kakaoId: REFEREE.kakaoId });
    const result = await run(db);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(REFEREE.phone);
    expect(serialized).not.toContain(REFEREE.email);
    expect(serialized).not.toContain("hash-abc");
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
