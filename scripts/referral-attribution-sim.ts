/**
 * Task 4 수동 QA 대체 시뮬레이션.
 *
 * 카카오 OAuth 이중 계정 E2E 는 이 샌드박스에서 돌릴 수 없으므로, 실제 DB 에
 * 트랜잭션을 열어 `attributeReferral` 의 쓰기 경로를 그대로 태우고 마지막에
 * 롤백한다. 잔여 행 0 을 같은 스크립트에서 확인한다.
 *
 *   pnpm exec tsx scripts/referral-attribution-sim.ts
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { attributeReferral } from "../src/lib/referral/attribute";
import { reconcileUserCoupons } from "../src/lib/coupons/reconcile";

config({ path: ".env.local" });
config({ path: ".env" });

// pooler(6543, transaction mode)에서는 인터랙티브 트랜잭션이 불안정하다. 세션 모드로 붙는다.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });

const ROLLBACK = new Error("__rollback__");
const RUN_ID = Math.random().toString(36).slice(2, 8);
const SIM_PREFIX = `sim-referral-${RUN_ID}`;
const SIM_CODE = `Z${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
const SIM_IP_HASH = `simhash${RUN_ID}`;

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

// kakaoId·supabaseId 는 DB 유일 제약이라 두 계정이 같은 값을 가질 수 없다.
// 실제로 재현 가능한 동일인 신호는 전화번호(유일 제약 없음)라서 그쪽으로 확인한다.
async function seedActors(tx: Tx, opts: { samePhone?: boolean } = {}) {
  const referrer = await tx.user.create({
    data: {
      supabaseId: `${SIM_PREFIX}-referrer`,
      kakaoId: `${SIM_PREFIX}-kakao-referrer`,
      email: `${SIM_PREFIX}-referrer@example.invalid`,
      name: "시뮬 추천인",
      phone: "010-1111-2222",
      referralCode: SIM_CODE,
      isActive: true,
    },
    select: { id: true },
  });
  const referee = await tx.user.create({
    data: {
      supabaseId: `${SIM_PREFIX}-referee`,
      kakaoId: `${SIM_PREFIX}-kakao-referee`,
      email: `${SIM_PREFIX}-referee@example.invalid`,
      name: "시뮬 피추천인",
      // 포맷을 일부러 다르게 준다 — 정규화 없이 비교하면 자기추천을 놓친다.
      phone: opts.samePhone ? "+82 10-1111-2222" : "010-3333-4444",
      isActive: true,
    },
    select: { id: true, kakaoId: true, phone: true, email: true, supabaseId: true },
  });
  return { referrerId: referrer.id, referee };
}

async function dumpRows(tx: Tx, referrerId: string) {
  const referrals = await tx.referral.findMany({
    where: { referrerId },
    select: { id: true, code: true, status: true, signupIpHash: true, refereeId: true },
  });
  const coupons = await tx.issuedCoupon.findMany({
    where: { referralId: { in: referrals.map((r) => r.id) } },
    select: {
      userId: true,
      status: true,
      titleSnapshot: true,
      rewardAmountSnapshot: true,
      expiresAt: true,
      referralId: true,
    },
    orderBy: { rewardAmountSnapshot: "desc" },
  });
  return { referrals, coupons };
}

/** 시나리오 하나를 실제 DB 트랜잭션에서 돌리고 무조건 롤백한다. */
async function scenario(
  label: string,
  body: (tx: Tx) => Promise<void>
): Promise<void> {
  console.log(`\n── ${label} ──────────────────────────────`);
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx);
        throw ROLLBACK;
      },
      { timeout: 20_000 }
    );
  } catch (error) {
    if (error !== ROLLBACK) throw error;
    console.log("   ↩︎ 트랜잭션 롤백 완료 (DB 잔여 없음)");
  }
}

async function main() {
  console.log(`run id: ${RUN_ID} / sim code: ${SIM_CODE}`);

  const policies = await prisma.couponPolicy.findMany({
    where: { trigger: { in: ["REFERRAL_GIVEN", "REFERRAL_RECEIVED"] } },
    select: { code: true, trigger: true, rewardAmount: true, validDays: true, isActive: true },
    orderBy: { code: "asc" },
  });
  console.log("\n활성 추천 정책:");
  for (const p of policies) {
    console.log(
      `   ${p.code} trigger=${p.trigger} reward=${p.rewardAmount} validDays=${p.validDays} active=${p.isActive}`
    );
  }

  await scenario("시나리오 A: 정상 추천 → REWARDED + 쿠폰 2장", async (tx) => {
    const { referrerId, referee } = await seedActors(tx);
    const result = await attributeReferral({
      db: tx,
      refereeUser: referee,
      referralCode: SIM_CODE,
      ipHash: SIM_IP_HASH,
    });
    console.log("   result:", JSON.stringify(result));
    const rows = await dumpRows(tx, referrerId);
    console.log("   Referral rows:", JSON.stringify(rows.referrals, null, 2));
    console.log("   IssuedCoupon rows:", JSON.stringify(rows.coupons, null, 2));
  });

  await scenario(
    "시나리오 B: 포맷만 다른 동일 전화(자기추천) → BLOCKED + 쿠폰 0장",
    async (tx) => {
    const { referrerId, referee } = await seedActors(tx, { samePhone: true });
    const result = await attributeReferral({
      db: tx,
      refereeUser: referee,
      referralCode: SIM_CODE,
      ipHash: SIM_IP_HASH,
    });
    console.log("   result:", JSON.stringify(result));
    const rows = await dumpRows(tx, referrerId);
    console.log("   Referral rows:", JSON.stringify(rows.referrals));
    console.log("   IssuedCoupon 개수:", rows.coupons.length);
    }
  );

  await scenario("시나리오 C: 같은 피추천인 재시도 → SKIPPED(멱등)", async (tx) => {
    const { referrerId, referee } = await seedActors(tx);
    const first = await attributeReferral({
      db: tx,
      refereeUser: referee,
      referralCode: SIM_CODE,
      ipHash: SIM_IP_HASH,
    });
    const second = await attributeReferral({
      db: tx,
      refereeUser: referee,
      referralCode: SIM_CODE,
      ipHash: SIM_IP_HASH,
    });
    console.log("   1회차:", JSON.stringify(first));
    console.log("   2회차:", JSON.stringify(second));
    const rows = await dumpRows(tx, referrerId);
    console.log(
      `   Referral 행 ${rows.referrals.length}개 / IssuedCoupon ${rows.coupons.length}장 (중복 발급 없음)`
    );
  });

  await scenario("시나리오 D: 없는 코드 → SKIPPED, 아무 것도 쓰지 않음", async (tx) => {
    const { referrerId, referee } = await seedActors(tx);
    const result = await attributeReferral({
      db: tx,
      refereeUser: referee,
      referralCode: "Q0000",
      ipHash: SIM_IP_HASH,
    });
    console.log("   result:", JSON.stringify(result));
    const rows = await dumpRows(tx, referrerId);
    console.log(`   Referral ${rows.referrals.length}행 / IssuedCoupon ${rows.coupons.length}장`);
  });

  await scenario(
    "시나리오 E: 추천인 쿠폰 동기화 격리 — reconcile 후에도 HELD 유지",
    async (tx) => {
      const { referrerId, referee } = await seedActors(tx);
      await attributeReferral({
        db: tx,
        refereeUser: referee,
        referralCode: SIM_CODE,
        ipHash: SIM_IP_HASH,
      });
      // 추천인 본인은 계약이 없다. 예전 로직이면 REFERRAL_GIVEN 이 이 동기화에 끌려간다.
      await reconcileUserCoupons(
        { id: referrerId, supabaseId: `${SIM_PREFIX}-referrer`, profileCompleted: true },
        tx
      );
      const after = await tx.issuedCoupon.findMany({
        where: { userId: referrerId },
        select: { status: true, titleSnapshot: true, referralId: true },
      });
      console.log("   reconcile 후 추천인 쿠폰:", JSON.stringify(after));
      const referralCoupon = after.find((c) => c.referralId !== null);
      console.log(
        `   추천 보상 쿠폰 상태=${referralCoupon?.status ?? "없음"} (HELD 여야 정상)`
      );
    }
  );

  console.log("\n── 잔여 확인 ──────────────────────────────");
  const leftoverUsers = await prisma.user.count({
    where: { supabaseId: { startsWith: SIM_PREFIX } },
  });
  const leftoverReferrals = await prisma.referral.count({ where: { code: SIM_CODE } });
  const leftoverCoupons = await prisma.issuedCoupon.count({
    where: { referral: { code: SIM_CODE } },
  });
  console.log(
    `   User ${leftoverUsers} / Referral ${leftoverReferrals} / IssuedCoupon ${leftoverCoupons}`
  );
  if (leftoverUsers + leftoverReferrals + leftoverCoupons !== 0) {
    throw new Error("잔여 행이 남았습니다 — 수동 정리 필요");
  }
  console.log("   ✅ 잔여 0 확인");
}

main()
  .catch((error) => {
    console.error("SIM FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
