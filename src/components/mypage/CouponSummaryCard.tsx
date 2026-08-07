import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import type { CouponBoxSummary } from "@/lib/member-queries/coupons";

const moneyFormatter = new Intl.NumberFormat("ko-KR");

interface CouponSummaryCardProps {
  summary: CouponBoxSummary;
}

export function CouponSummaryCard({ summary }: CouponSummaryCardProps) {
  const totalCount = summary.heldCount + summary.pendingCount;
  const hasPending = summary.pendingCount > 0;

  const headline = hasPending
    ? `지급 예정 쿠폰 ${summary.pendingCount}장이 있어요`
    : totalCount > 0
      ? `보유 쿠폰 ${totalCount}장`
      : "받을 수 있는 혜택을 확인해 보세요";

  const detail =
    totalCount > 0
      ? `계약 완료 시 ${moneyFormatter.format(summary.totalAmount)}원 상당의 혜택을 받아요`
      : "첫가입과 첫계약에는 축하 혜택이 준비되어 있어요";

  return (
    <Link
      href="/mypage/coupons"
      className={`mb-10 flex items-center gap-3 rounded-card border p-4 transition-shadow duration-state hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:mb-12 md:p-5 ${
        hasPending ? "border-brand/25 bg-brand-soft" : "border-border-subtle bg-surface"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${
          hasPending ? "bg-brand text-white" : "bg-surface-soft text-brand"
        }`}
      >
        <Ticket size={21} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-extrabold text-text-strong">{headline}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-text-body">{detail}</span>
      </span>
      <ArrowRight size={18} strokeWidth={2.2} className="shrink-0 text-text-muted" aria-hidden="true" />
    </Link>
  );
}
