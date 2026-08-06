export type CouponTriggerValue = "SIGNUP" | "FIRST_CONTRACT";
export type CouponStatusValue = "HELD" | "PENDING" | "PAID" | "EXPIRED" | "REVOKED";

export interface PolicyView {
  id: string;
  trigger: CouponTriggerValue;
  title: string;
  rewardLabel: string;
  rewardAmount: number | null;
  validDays: number | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface CouponView {
  id: string;
  policyId: string;
  status: CouponStatusValue;
  expiresAt: Date | null;
}

export interface CouponReconcileInput {
  now: Date;
  profileCompleted: boolean;
  /** 계약 완료된 견적 id. null 이면 계약이 없다. */
  convertedQuoteId: string | null;
  policies: readonly PolicyView[];
  coupons: readonly CouponView[];
}

export interface CouponIssuePlan {
  policyId: string;
  titleSnapshot: string;
  rewardLabelSnapshot: string;
  rewardAmountSnapshot: number | null;
  expiresAt: Date | null;
  status: "HELD" | "PENDING";
  qualifiedQuoteId: string | null;
}

export interface CouponReconcilePlan {
  issue: CouponIssuePlan[];
  /** HELD → PENDING 으로 올릴 IssuedCoupon.id */
  qualify: string[];
  /** PENDING → HELD 로 되돌릴 IssuedCoupon.id */
  unqualify: string[];
  /** HELD → EXPIRED 로 바꿀 IssuedCoupon.id */
  expire: string[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * MS_PER_DAY);
}

/** 신규 발급을 받을 수 있는 정책인지 (활성 + 노출 기간 안). */
function isPolicyOpen(policy: PolicyView, now: Date): boolean {
  if (!policy.isActive) return false;
  if (policy.startsAt && policy.startsAt.getTime() > now.getTime()) return false;
  if (policy.endsAt && policy.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/** 카드가 쿠폰함에 생기는 조건. */
function meetsIssueCondition(
  trigger: CouponTriggerValue,
  input: CouponReconcileInput
): boolean {
  return trigger === "SIGNUP" ? input.profileCompleted : input.convertedQuoteId !== null;
}

/**
 * 쿠폰 동기화 계획을 세운다. DB 를 모르는 순수 함수다.
 * 지급 조건(PENDING 전이)은 두 trigger 모두 "계약 완료"로 같다.
 */
export function planCouponReconcile(input: CouponReconcileInput): CouponReconcilePlan {
  const paidQualified = input.convertedQuoteId !== null;
  const ownedPolicyIds = new Set(input.coupons.map((coupon) => coupon.policyId));

  const issue: CouponIssuePlan[] = input.policies
    .filter((policy) => !ownedPolicyIds.has(policy.id))
    .filter((policy) => isPolicyOpen(policy, input.now))
    .filter((policy) => meetsIssueCondition(policy.trigger, input))
    .map((policy) => ({
      policyId: policy.id,
      titleSnapshot: policy.title,
      rewardLabelSnapshot: policy.rewardLabel,
      rewardAmountSnapshot: policy.rewardAmount,
      expiresAt: policy.validDays === null ? null : addDays(input.now, policy.validDays),
      status: paidQualified ? "PENDING" : "HELD",
      qualifiedQuoteId: paidQualified ? input.convertedQuoteId : null,
    }));

  const qualify: string[] = [];
  const unqualify: string[] = [];
  const expire: string[] = [];

  for (const coupon of input.coupons) {
    if (coupon.status === "HELD") {
      // 만료가 지급 자격보다 우선한다. 계약이 있어도 유효기간이 지났으면 만료시킨다.
      // 지급 여부가 방문 시점에 좌우되면 안 된다 — 만료를 계약 확인보다 뒤에 두면,
      // 3월에 유효기간이 지났지만 회원이 그동안 방문하지 않아 스윕되지 않은 쿠폰이
      // 8월에 로그인하는 순간 계약 여부만으로 PENDING 승격돼 버린다. 같은 조건인데
      // 4월에 마이페이지를 열었던 회원은 이미 EXPIRED 로 정리돼 못 받는 것과 형평이
      // 어긋난다.
      const expired =
        coupon.expiresAt !== null && coupon.expiresAt.getTime() <= input.now.getTime();
      if (expired) {
        expire.push(coupon.id);
        continue;
      }
      if (paidQualified) {
        qualify.push(coupon.id);
      }
      continue;
    }

    if (coupon.status === "PENDING" && !paidQualified) {
      unqualify.push(coupon.id);
    }
  }

  return { issue, qualify, unqualify, expire };
}
