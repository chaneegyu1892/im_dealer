import Image from "next/image";
import { CarFront } from "lucide-react";
import { StatusPill } from "@/components/mypage/ActiveQuoteSection";
import { QuoteConditionDialog } from "@/components/mypage/QuoteConditionDialog";
import { MyPageConsultationButton } from "@/components/mypage/MyPageConsultationButton";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { productTypeLabel } from "@/constants/product-type";
import type { MyPageQuote } from "@/lib/member-queries/mypage";
import { getExpiryLabel, getQuoteHref, moneyFormatter } from "@/lib/member-queries/mypage-format";

export function QuoteCard({ quote }: { quote: MyPageQuote }) {
  const quoteHref = getQuoteHref(quote);

  return (
    <article className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card transition-shadow duration-state hover:shadow-card-hover">
      <div className="flex gap-3 p-4 md:p-5">
        <div className="relative flex h-[76px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-surface-soft">
          {quote.thumbnailUrl ? (
            <Image
              src={quote.thumbnailUrl}
              alt={`${quote.vehicleBrand ? `${quote.vehicleBrand} ` : ""}${quote.vehicleName}`}
              fill
              sizes="96px"
              unoptimized={isSupabaseStorageUrl(quote.thumbnailUrl)}
              className="object-cover"
            />
          ) : (
            <CarFront size={26} strokeWidth={1.6} className="text-text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[12px] font-bold text-text-muted">{quote.vehicleBrand ?? "아임딜러 견적"}</p>
            <StatusPill quote={quote} />
          </div>
          <h3 className="mt-0.5 line-clamp-1 text-[18px] font-extrabold text-text-strong">{quote.vehicleName}</h3>
          <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-text-body">{quote.trimName}</p>
          <div className="mt-2 flex items-end gap-1">
            <span className="tabular-nums text-[20px] font-extrabold tracking-[-0.02em] text-text-strong">
              {quote.pricingStatus === "CALCULATED" ? moneyFormatter.format(quote.monthlyPayment) : "상담 확인"}
            </span>
            {quote.pricingStatus === "CALCULATED" && <span className="pb-0.5 text-[12px] font-bold text-text-muted">원/월</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-border-subtle bg-surface-soft/70 text-[12px] font-semibold text-text-body">
        <span className="px-4 py-3">{productTypeLabel(quote.productType)} · {quote.contractMonths}개월</span>
        <span className="border-l border-border-subtle px-4 py-3 text-right">{getExpiryLabel(quote.expiresAt)}</span>
      </div>
      <div className="flex items-center gap-2 border-t border-border-subtle p-3">
        <QuoteConditionDialog
          quote={quote}
          quoteHref={quoteHref}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-btn border border-border-strong bg-surface px-3 text-[12px] font-extrabold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          iconSize={14}
        />
        <MyPageConsultationButton
          quoteId={quote.id}
          sessionId={quote.sessionId}
          vehicleName={quote.vehicleName}
          trimName={quote.trimName}
          productType={quote.productType}
          contractMonths={quote.contractMonths}
          annualMileage={quote.annualMileage}
          label="상담"
          className="min-h-10 !w-auto px-3"
        />
      </div>
    </article>
  );
}
