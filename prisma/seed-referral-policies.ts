/**
 * 추천인 보상 쿠폰 정책 시드.
 *
 * `prisma/seed.ts` 가 이 함수를 호출한다. 정책만 다시 넣고 싶으면 단독 실행도 된다:
 *   pnpm exec tsx prisma/seed-referral-policies.ts
 *
 * 이 정책들은 `planCouponReconcile` 이 자동 발급하지 않는다. 추천이 성립하는 순간
 * `IssuedCoupon.referralId` 와 함께 직접 발급된다.
 */
import { PrismaClient } from "@prisma/client";

type PolicySeed = {
  code: string;
  trigger: "REFERRAL_RECEIVED" | "REFERRAL_GIVEN";
  title: string;
  description: string;
  rewardLabel: string;
  rewardAmount: number;
  termsNote: string;
  displayOrder: number;
};

export const REFERRAL_COUPON_POLICIES: readonly PolicySeed[] = [
  {
    code: "REFERRAL_RECEIVED",
    trigger: "REFERRAL_RECEIVED",
    title: "추천 가입 축하 캐시백",
    description: "추천인 코드로 가입해서 받은 혜택이에요",
    rewardLabel: "3만원 캐시백",
    rewardAmount: 30000,
    termsNote: "계약 완료 후 영업담당자 확인을 거쳐 지급됩니다.",
    displayOrder: 30,
  },
  {
    code: "REFERRAL_GIVEN",
    trigger: "REFERRAL_GIVEN",
    title: "친구 추천 감사 캐시백",
    description: "추천한 친구가 가입하면 지급돼요",
    rewardLabel: "5만원 캐시백",
    rewardAmount: 50000,
    termsNote: "추천받은 회원의 계약 완료 후 지급됩니다.",
    displayOrder: 40,
  },
];

const VALID_DAYS = 180;

/** code 기준 upsert 이므로 몇 번 돌려도 결과가 같다. 기존 정책의 어드민 수정본은 덮지 않는다. */
export async function seedReferralCouponPolicies(prisma: PrismaClient): Promise<void> {
  for (const policy of REFERRAL_COUPON_POLICIES) {
    await prisma.couponPolicy.upsert({
      where: { code: policy.code },
      update: {},
      create: { ...policy, rewardKind: "GIFT", validDays: VALID_DAYS, isActive: true },
    });
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedReferralCouponPolicies(prisma);
    console.log(`✅ 추천인 쿠폰 정책 ${REFERRAL_COUPON_POLICIES.length}건 준비 완료`);
  } finally {
    await prisma.$disconnect();
  }
}

// 단독 실행일 때만 동작한다. seed.ts 에서 import 할 때는 아무 일도 하지 않는다.
if (process.argv[1] && process.argv[1].endsWith("seed-referral-policies.ts")) {
  void main();
}
