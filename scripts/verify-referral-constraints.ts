/**
 * 추천인 마이그레이션의 실제 DB 제약을 검증한다.
 *
 * 모든 쓰기는 곧바로 롤백되는 트랜잭션 안에서만 일어난다(테스트 데이터 잔존 없음).
 * P2002 는 트랜잭션을 abort 시키므로 실패를 기대하는 케이스마다 트랜잭션을 분리한다.
 *
 * 실행: pnpm exec tsx scripts/verify-referral-constraints.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** 이 에러로 트랜잭션을 빠져나가면 커밋되지 않는다. */
class Rollback extends Error {
  constructor(readonly payload: unknown) {
    super("rollback");
  }
}

const stamp = Date.now();
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function isP2002(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** 트랜잭션을 열고 반드시 롤백한다. 안에서 던진 값은 그대로 돌려준다. */
async function inRolledBackTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    await prisma.$transaction(async (tx) => {
      throw new Rollback(await fn(tx));
    });
  } catch (error) {
    if (error instanceof Rollback) return error.payload as T;
    throw error;
  }
  throw new Error("unreachable: transaction committed");
}

async function makeUser(tx: Prisma.TransactionClient, tag: string) {
  return tx.user.create({
    data: { name: `verify-${tag}-${stamp}`, email: `verify-${tag}-${stamp}@example.invalid` },
  });
}

async function makePolicy(tx: Prisma.TransactionClient, tag: string) {
  return tx.couponPolicy.create({
    data: {
      code: `VERIFY_${tag}_${stamp}`,
      trigger: "REFERRAL_GIVEN",
      title: "검증용 정책",
      rewardLabel: "5만원 캐시백",
      rewardAmount: 50000,
    },
  });
}

function couponData(userId: string, policyId: string, referralId: string | null, tag: string) {
  return {
    userId,
    policyId,
    referralId,
    code: `VERIFY-${tag}-${stamp}`,
    titleSnapshot: "검증용 정책",
    rewardLabelSnapshot: "5만원 캐시백",
    rewardAmountSnapshot: 50000,
  };
}

/** (a) 추천인은 서로 다른 추천 건이면 같은 정책 쿠폰을 여러 장 가질 수 있어야 한다. */
async function referrerAccruesAcrossReferrals(): Promise<void> {
  const result = await inRolledBackTx(async (tx) => {
    const [referrer, refereeA, refereeB] = await Promise.all([
      makeUser(tx, "referrer"),
      makeUser(tx, "refereeA"),
      makeUser(tx, "refereeB"),
    ]);
    const policy = await makePolicy(tx, "accrue");

    const referralA = await tx.referral.create({
      data: { referrerId: referrer.id, refereeId: refereeA.id, code: "A1234" },
    });
    const referralB = await tx.referral.create({
      data: { referrerId: referrer.id, refereeId: refereeB.id, code: "A1234" },
    });

    await tx.issuedCoupon.create({
      data: couponData(referrer.id, policy.id, referralA.id, "accrue-1"),
    });
    await tx.issuedCoupon.create({
      data: couponData(referrer.id, policy.id, referralB.id, "accrue-2"),
    });

    return tx.issuedCoupon.count({ where: { userId: referrer.id, policyId: policy.id } });
  });

  check("referrer keeps 2 coupons for same policy across different referrals", result === 2, `count=${result}`);
}

/** (b) 추천과 무관한 쿠폰(referralId NULL)은 여전히 1인 1매여야 한다. */
async function nonReferralStaysOnePerUser(): Promise<void> {
  const outcome = await inRolledBackTx(async (tx) => {
    const user = await makeUser(tx, "solo");
    const policy = await makePolicy(tx, "solo");

    await tx.issuedCoupon.create({ data: couponData(user.id, policy.id, null, "solo-1") });
    try {
      await tx.issuedCoupon.create({ data: couponData(user.id, policy.id, null, "solo-2") });
      return "no-error";
    } catch (error) {
      return isP2002(error) ? "P2002" : `other:${String(error)}`;
    }
  });

  check("duplicate non-referral coupon (referralId NULL) still rejected", outcome === "P2002", outcome);
}

/** (c) 같은 추천 건 + 같은 정책으로는 두 번 발급되지 않아야 한다. */
async function referralPairIssuedOnce(): Promise<void> {
  const outcome = await inRolledBackTx(async (tx) => {
    const [referrer, referee] = await Promise.all([
      makeUser(tx, "pair-referrer"),
      makeUser(tx, "pair-referee"),
    ]);
    const policy = await makePolicy(tx, "pair");
    const referral = await tx.referral.create({
      data: { referrerId: referrer.id, refereeId: referee.id, code: "A1234" },
    });

    await tx.issuedCoupon.create({ data: couponData(referrer.id, policy.id, referral.id, "pair-1") });
    try {
      await tx.issuedCoupon.create({ data: couponData(referrer.id, policy.id, referral.id, "pair-2") });
      return "no-error";
    } catch (error) {
      return isP2002(error) ? "P2002" : `other:${String(error)}`;
    }
  });

  check("same policy + same referral cannot be issued twice", outcome === "P2002", outcome);
}

/** (d) 피추천인은 평생 1회만 귀속된다. */
async function refereeAttributedOnce(): Promise<void> {
  const outcome = await inRolledBackTx(async (tx) => {
    const [first, second, referee] = await Promise.all([
      makeUser(tx, "ref1"),
      makeUser(tx, "ref2"),
      makeUser(tx, "shared-referee"),
    ]);

    await tx.referral.create({ data: { referrerId: first.id, refereeId: referee.id, code: "A1234" } });
    try {
      await tx.referral.create({ data: { referrerId: second.id, refereeId: referee.id, code: "B5678" } });
      return "no-error";
    } catch (error) {
      return isP2002(error) ? "P2002" : `other:${String(error)}`;
    }
  });

  check("referee can only be attributed to one referrer", outcome === "P2002", outcome);
}

async function reportDbObjects(): Promise<void> {
  const indexes = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename IN ('IssuedCoupon', 'Referral', 'User')
      AND (indexname LIKE 'IssuedCoupon%' OR indexname LIKE 'Referral%' OR indexname = 'User_referralCode_key')
    ORDER BY indexname;
  `;
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Referral';
  `;
  const enums = await prisma.$queryRaw<{ typname: string; enumlabel: string }[]>`
    SELECT t.typname, e.enumlabel FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname IN ('CouponTrigger', 'ReferralStatus')
    ORDER BY t.typname, e.enumsortorder;
  `;
  const policies = await prisma.couponPolicy.findMany({
    where: { code: { in: ["REFERRAL_RECEIVED", "REFERRAL_GIVEN"] } },
    select: { code: true, trigger: true, rewardLabel: true, rewardAmount: true, validDays: true, isActive: true },
    orderBy: { code: "asc" },
  });

  console.log("\n--- tables ---");
  console.log(tables.map((t) => t.table_name).join("\n") || "(none)");
  console.log("\n--- indexes ---");
  for (const index of indexes) console.log(`${index.indexname}: ${index.indexdef}`);
  console.log("\n--- enum values ---");
  for (const value of enums) console.log(`${value.typname}.${value.enumlabel}`);
  console.log("\n--- seeded referral policies ---");
  console.log(policies.length === 0 ? "(none)" : JSON.stringify(policies, null, 2));

  check(
    "partial unique indexes present",
    indexes.some((i) => i.indexname === "IssuedCoupon_nonreferral_unique" && i.indexdef.includes("IS NULL")) &&
      indexes.some((i) => i.indexname === "IssuedCoupon_referral_unique" && i.indexdef.includes("IS NOT NULL"))
  );
  check(
    "blanket IssuedCoupon_userId_policyId_key is gone",
    !indexes.some((i) => i.indexname === "IssuedCoupon_userId_policyId_key")
  );
  check("Referral table exists", tables.length === 1);
  check("both referral coupon policies seeded", policies.length === 2);
}

async function assertNoResidue(): Promise<void> {
  const [users, policies, referrals, coupons] = await Promise.all([
    prisma.user.count({ where: { name: { startsWith: "verify-" } } }),
    prisma.couponPolicy.count({ where: { code: { startsWith: "VERIFY_" } } }),
    prisma.referral.count({ where: { code: { in: ["A1234", "B5678"] } } }),
    prisma.issuedCoupon.count({ where: { code: { startsWith: "VERIFY-" } } }),
  ]);
  check(
    "no test rows left behind (all transactions rolled back)",
    users === 0 && policies === 0 && referrals === 0 && coupons === 0,
    `users=${users} policies=${policies} referrals=${referrals} coupons=${coupons}`
  );
}

async function main(): Promise<void> {
  console.log(`referral constraint verification @ ${new Date().toISOString()}\n`);
  await referrerAccruesAcrossReferrals();
  await nonReferralStaysOnePerUser();
  await referralPairIssuedOnce();
  await refereeAttributedOnce();
  await reportDbObjects();
  await assertNoResidue();

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("verification crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
