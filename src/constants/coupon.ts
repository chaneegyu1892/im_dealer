import { Fuel, Gift, Ticket, Wallet, type LucideIcon } from "lucide-react";
import type { CouponStatusValue } from "@/lib/coupons/rules";

export const COUPON_STATUS_LABEL: Record<CouponStatusValue, string> = {
  HELD: "보유",
  PENDING: "지급 준비 중",
  PAID: "지급 완료",
  EXPIRED: "기간 만료",
  REVOKED: "지급 취소",
};

const REWARD_ICON: Record<string, LucideIcon> = {
  FUEL: Fuel,
  CASH: Wallet,
  GIFT: Gift,
};

/** 모르는 rewardKind 가 와도 기본 아이콘으로 떨어진다. */
export function couponRewardIcon(rewardKind: string): LucideIcon {
  return REWARD_ICON[rewardKind] ?? Ticket;
}
