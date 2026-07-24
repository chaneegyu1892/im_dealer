"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CircleDollarSign, SlidersHorizontal } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { MyPageQuote } from "@/lib/member-queries/mypage";

interface QuoteConditionDialogProps {
  quote: MyPageQuote;
  quoteHref: string | null;
  label?: string;
  className: string;
  iconSize?: number;
}

const moneyFormatter = new Intl.NumberFormat("ko-KR");
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const customerTypeLabels: Record<string, string> = {
  individual: "개인",
  self_employed: "개인사업자",
  corporate: "법인",
  nonprofit: "비영리법인",
};

function formatMileage(annualMileage: number) {
  return `${moneyFormatter.format(annualMileage)}km`;
}

function formatRate(rate: number) {
  return rate > 0 ? `${rate}%` : "없음";
}

function formatAdditionalPrice(price: number) {
  return price > 0 ? `+${moneyFormatter.format(price)}원` : "기본 포함";
}

function formatExpiry(expiresAt: Date) {
  if (expiresAt.getTime() <= Date.now()) return "만료됨";
  return dateFormatter.format(expiresAt);
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-surface-soft px-3.5 py-3">
      <p className="text-[11px] font-bold text-text-muted">{label}</p>
      <p className="mt-1 text-[14px] font-extrabold text-text-strong">{value}</p>
    </div>
  );
}

export function QuoteConditionDialog({
  quote,
  quoteHref,
  label = "견적 조건 보기",
  className,
  iconSize = 16,
}: QuoteConditionDialogProps) {
  const [open, setOpen] = useState(false);
  const customerType = customerTypeLabels[quote.customerType] ?? quote.customerType;
  const monthlyPayment = quote.pricingStatus === "CALCULATED"
    ? `${moneyFormatter.format(quote.monthlyPayment)}원`
    : "상담 후 안내";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={className}
      >
        {label}
        <ChevronRight size={iconSize} strokeWidth={2.4} aria-hidden="true" />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="견적 조건"
        closeAriaLabel="견적 조건 닫기"
        maxHeight="88vh"
      >
        <div className="space-y-5 pb-1">
          <section className="rounded-card border border-brand/15 bg-brand-soft/45 p-4">
            <p className="text-[12px] font-extrabold text-brand">저장한 견적 기준</p>
            <h4 className="mt-1 text-[20px] font-extrabold tracking-[-0.02em] text-text-strong">
              {quote.vehicleBrand ? `${quote.vehicleBrand} ` : ""}{quote.vehicleName}
            </h4>
            <p className="mt-1 text-[14px] font-semibold text-text-body">{quote.trimName}</p>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-brand/10 pt-3">
              <div>
                <p className="text-[11px] font-bold text-text-muted">월 납입금</p>
                <p className="mt-0.5 text-[20px] font-extrabold tracking-[-0.02em] text-text-strong">
                  {monthlyPayment}
                  {quote.pricingStatus === "CALCULATED" && <span className="ml-1 text-[12px] text-text-muted">/ 월</span>}
                </p>
              </div>
              <span className="rounded-pill bg-surface px-2.5 py-1.5 text-[11px] font-extrabold text-text-body shadow-card">
                {quote.productType}
              </span>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <SlidersHorizontal size={16} strokeWidth={2.2} className="text-brand" aria-hidden="true" />
              <h4 className="text-[15px] font-extrabold text-text-strong">계약 조건</h4>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailItem label="이용 고객" value={customerType} />
              <DetailItem label="계약 방식" value={quote.contractType} />
              <DetailItem label="계약 기간" value={`${quote.contractMonths}개월`} />
              <DetailItem label="연간 주행거리" value={formatMileage(quote.annualMileage)} />
              <DetailItem label="보증금" value={formatRate(quote.depositRate)} />
              <DetailItem label="선납금" value={formatRate(quote.prepayRate)} />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <CircleDollarSign size={16} strokeWidth={2.2} className="text-brand" aria-hidden="true" />
              <h4 className="text-[15px] font-extrabold text-text-strong">차량 구성</h4>
            </div>
            <div className="overflow-hidden rounded-card border border-border-subtle bg-surface">
              {quote.totalVehiclePrice !== null && (
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-3.5 py-3">
                  <span className="text-[13px] font-semibold text-text-body">차량 기준가</span>
                  <span className="text-[13px] font-extrabold tabular-nums text-text-strong">
                    {moneyFormatter.format(quote.totalVehiclePrice)}원
                  </span>
                </div>
              )}
              <div className="px-3.5 py-3">
                <p className="text-[12px] font-bold text-text-muted">선택 옵션</p>
                {quote.selectedOptions.length > 0 ? (
                  <ul className="mt-2 divide-y divide-border-subtle">
                    {quote.selectedOptions.map((option) => (
                      <li key={option.id ?? option.name} className="flex items-start justify-between gap-3 py-2 text-[13px]">
                        <span className="min-w-0 font-semibold text-text-body">{option.name}</span>
                        <span className="shrink-0 font-bold tabular-nums text-text-muted">{formatAdditionalPrice(option.price)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[13px] text-text-body">선택한 옵션이 없어요.</p>
                )}
              </div>
              <div className="grid grid-cols-2 border-t border-border-subtle text-[13px]">
                <div className="border-r border-border-subtle px-3.5 py-3">
                  <p className="text-[12px] font-bold text-text-muted">외장 색상</p>
                  <p className="mt-1 font-extrabold text-text-strong">{quote.exteriorColor?.name ?? "미선택"}</p>
                </div>
                <div className="px-3.5 py-3">
                  <p className="text-[12px] font-bold text-text-muted">내장 색상</p>
                  <p className="mt-1 font-extrabold text-text-strong">{quote.interiorColor?.name ?? "미선택"}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-card bg-surface-soft px-3.5 py-3 text-[12px] leading-5 text-text-body">
            <p>견적 생성일 {dateFormatter.format(quote.createdAt)} · 유효일 {formatExpiry(quote.expiresAt)}</p>
            <p className="mt-1">저장 시점 기준 조건이며, 조건이나 차량가를 변경하면 월 납입금이 달라질 수 있어요.</p>
          </section>

          <div className="grid gap-2">
            {quoteHref && (
              <Link
                href={quoteHref}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn border border-border-strong bg-surface px-4 text-[13px] font-extrabold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                조건 변경 후 새 견적 받기
                <ChevronRight size={15} strokeWidth={2.4} aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-btn bg-brand px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              확인했어요
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
