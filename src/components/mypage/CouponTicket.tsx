import { createElement } from "react";
import { COUPON_STATUS_LABEL, couponRewardIcon } from "@/constants/coupon";
import type { CouponBoxItem } from "@/lib/member-queries/coupons";
import type { CouponStatusValue } from "@/lib/coupons/rules";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
});

interface StatusStyle {
  stub: string;
  frame: string;
  chip: string;
  title: string;
  // 절취선이 흰 카드 본문(bg-surface) 위에 그려지므로 저채도 색은 사실상
  // 안 보인다. 값을 낮출 때는 실제 카드에서 눈으로 확인할 것.
  divider: string;
}

const STATUS_STYLE: Record<CouponStatusValue, StatusStyle> = {
  PENDING: {
    stub: "bg-brand text-white",
    // Tailwind 의 비-inset ring 은 바깥쪽 box-shadow 인데, 아래 NOTCH_MASK 가
    // mask-clip: border-box 로 적용돼 바깥 그림자를 잘라낸다. ring-inset 을 써야
    // 실제로 보인다.
    frame: "ring-1 ring-inset ring-brand/25",
    chip: "bg-status-warning-soft text-status-warning",
    title: "text-text-strong",
    divider: "border-brand/40",
  },
  HELD: {
    stub: "bg-brand-soft text-brand",
    frame: "ring-1 ring-inset ring-border-subtle",
    chip: "bg-surface-soft text-text-body",
    title: "text-text-strong",
    divider: "border-border-strong",
  },
  PAID: {
    stub: "bg-status-positive-soft text-status-positive",
    frame: "ring-1 ring-inset ring-border-subtle",
    chip: "bg-status-positive-soft text-status-positive",
    title: "text-text-body",
    divider: "border-border-strong",
  },
  EXPIRED: {
    stub: "bg-surface-soft text-text-muted",
    frame: "ring-1 ring-inset ring-border-subtle",
    chip: "bg-surface-soft text-text-muted",
    title: "text-text-muted",
    divider: "border-border-subtle",
  },
  REVOKED: {
    stub: "bg-surface-soft text-text-muted",
    frame: "ring-1 ring-inset ring-border-subtle",
    chip: "bg-surface-soft text-text-muted",
    title: "text-text-muted",
    divider: "border-border-subtle",
  },
};

// 절취선 양끝에 반원 구멍을 뚫는다. 배경색 원을 덧대면 다크모드나 섹션 배경이
// 바뀔 때 티가 나므로 마스크로 실제 구멍을 만든다.
const NOTCH_MASK = {
  WebkitMaskImage:
    "radial-gradient(circle at 104px 0, transparent 9px, #000 9.5px), radial-gradient(circle at 104px 100%, transparent 9px, #000 9.5px)",
  maskImage:
    "radial-gradient(circle at 104px 0, transparent 9px, #000 9.5px), radial-gradient(circle at 104px 100%, transparent 9px, #000 9.5px)",
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
} as const;

const PAST_STATUSES: ReadonlySet<CouponStatusValue> = new Set<CouponStatusValue>([
  "EXPIRED",
  "REVOKED",
]);

const moneyFormatter = new Intl.NumberFormat("ko-KR");

/** 스텁에 들어갈 짧은 금액. 100000 → "10만원", 금액이 없으면 "혜택". */
function shortAmount(amount: number | null): string {
  if (amount === null) return "혜택";
  if (amount >= 10_000 && amount % 10_000 === 0) return `${amount / 10_000}만원`;
  return `${moneyFormatter.format(amount)}원`;
}

function daysLeftLabel(expiresAt: Date | null): string | null {
  if (!expiresAt) return null;
  const diff = expiresAt.getTime() - Date.now();
  if (diff <= 0) return null;
  return `D-${Math.ceil(diff / (1000 * 60 * 60 * 24))}`;
}

function statusLabel(coupon: CouponBoxItem): string {
  const base = COUPON_STATUS_LABEL[coupon.status];
  if (coupon.status === "PAID" && coupon.paidAt) {
    return `${base} · ${dateFormatter.format(coupon.paidAt)}`;
  }
  return base;
}

interface CouponTicketProps {
  coupon: CouponBoxItem;
}

export function CouponTicket({ coupon }: CouponTicketProps) {
  const style = STATUS_STYLE[coupon.status];
  const daysLeft = coupon.status === "HELD" ? daysLeftLabel(coupon.expiresAt) : null;
  const showCode = !PAST_STATUSES.has(coupon.status);
  // couponRewardIcon 이 반환하는 아이콘을 JSX 태그 자리 변수에 담으면
  // react-hooks/static-components 가 "렌더 중 컴포넌트 생성"으로 오탐한다.
  // createElement 로 직접 만들어 그 검사를 피한다.
  const rewardIcon = createElement(couponRewardIcon(coupon.rewardKind), {
    size: 22,
    strokeWidth: 1.9,
    "aria-hidden": true,
  });

  return (
    <article
      className={cn("flex overflow-hidden rounded-card bg-surface", style.frame)}
      style={NOTCH_MASK}
    >
      <div
        className={cn(
          "flex w-[104px] shrink-0 flex-col items-center justify-center gap-1.5 px-2 py-5",
          style.stub
        )}
      >
        {rewardIcon}
        <span className="break-keep text-center text-[15px] font-extrabold tabular-nums">
          {shortAmount(coupon.rewardAmount)}
        </span>
      </div>

      <div className={cn("w-0 border-l border-dashed", style.divider)} aria-hidden="true" />

      <div className="min-w-0 flex-1 px-4 py-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-extrabold",
              style.chip
            )}
          >
            {statusLabel(coupon)}
          </span>
          {daysLeft && (
            <span className="text-[11px] font-bold text-text-muted">{daysLeft}</span>
          )}
        </div>
        <h3 className={cn("text-[16px] font-extrabold", style.title)}>{coupon.title}</h3>
        <p className="mt-0.5 text-[13px] font-bold text-text-body">{coupon.rewardLabel}</p>
        {coupon.description && (
          <p className="mt-1 text-[13px] leading-5 text-text-muted">{coupon.description}</p>
        )}
        {showCode && (
          <p className="mt-2 font-mono text-[12px] tracking-wide text-text-muted">
            {coupon.code}
          </p>
        )}
      </div>
    </article>
  );
}
