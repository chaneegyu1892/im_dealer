// 2026-08-18 쿠폰 정책 개편 (1회성 운영 스크립트)
//
// 1) 첫가입 주유권(SIGNUP, 10만원) 정책 비활성화 + 미사용(HELD) 6장 회수
// 2) 기존 첫계약 30만원권(FIRST_CONTRACT) 정책 비활성화
// 3) 신규 "아임딜러 계약 혜택 30만원권" 생성 — SIGNUP 트리거(가입 즉시 자동 발급),
//    본인 계약 완료 시 지급 대상, 유효기간 180일
//
// 지급예정(PENDING)·지급완료(PAID) 쿠폰은 건드리지 않는다(이미 계약으로 확정된 약속).
//
// 실행: set -a && source .env && set +a && node scripts/ops-20260818-coupon-policy-restructure.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const result = await prisma.$transaction(async (tx) => {
  const fuel = await tx.couponPolicy.update({
    where: { id: "cpol_signup_fuel_100k" },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
  const oldContract = await tx.couponPolicy.update({
    where: { id: "cpol_first_contract_cash_300k" },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });
  const created = await tx.couponPolicy.create({
    data: {
      code: "SIGNUP_CONTRACT_BENEFIT_300K",
      trigger: "SIGNUP",
      title: "아임딜러 계약 혜택 30만원권",
      description: "가입 혜택 — 계약 완료 후 백화점 상품권 30만원을 드려요.",
      rewardLabel: "백화점 30만원 상품권",
      rewardAmount: 300000,
      rewardKind: "GIFT",
      validDays: 180,
      isActive: true,
      displayOrder: 0,
    },
    select: { id: true, code: true, trigger: true, validDays: true },
  });
  const revoked = await tx.issuedCoupon.updateMany({
    where: { policyId: "cpol_signup_fuel_100k", status: "HELD" },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
      revokeReason: "쿠폰 정책 개편(첫가입 주유권 종료)",
    },
  });
  return { fuel, oldContract, created, revokedCount: revoked.count };
});

console.log("applied:", JSON.stringify(result, null, 2));

// 기존 30만원권 보유자 — 새 SIGNUP 30만원권이 중복 발급될 수 있어 지급 시 확인 필요
const dupRisk = await prisma.issuedCoupon.findMany({
  where: { policyId: "cpol_first_contract_cash_300k" },
  select: { status: true, user: { select: { id: true, name: true } } },
});
console.log(
  "old-300k holders (지급 시 중복 확인 대상):",
  JSON.stringify(
    dupRisk.map((d) => ({
      status: d.status,
      userId: d.user.id,
      name: `${d.user.name[0] ?? ""}*`,
    })),
  ),
);

const policies = await prisma.couponPolicy.findMany({
  orderBy: { createdAt: "asc" },
  select: { trigger: true, title: true, isActive: true, rewardAmount: true, validDays: true },
});
console.log("final policies:", JSON.stringify(policies, null, 1));

const fuelCoupons = await prisma.issuedCoupon.groupBy({
  by: ["status"],
  where: { policyId: "cpol_signup_fuel_100k" },
  _count: { _all: true },
});
console.log(
  "fuel coupons by status:",
  JSON.stringify(fuelCoupons.map((r) => ({ status: r.status, count: r._count._all }))),
);

await prisma.$disconnect();
