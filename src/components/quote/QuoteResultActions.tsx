"use client";

import { CheckCircle2, ClipboardCheck } from "lucide-react";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";

interface QuoteResultActionsProps {
  readonly onContractApply: () => void;
  readonly isApplying: boolean;
  readonly applyError: string | null;
  readonly kakaoDeliveryEnabled: boolean;
  readonly isDelivering: boolean;
  readonly deliverySuccess: boolean;
  readonly deliveryError: string | null;
  readonly onQuoteDeliver: () => void;
}

export function QuoteResultActions({
  onContractApply,
  isApplying,
  applyError,
  kakaoDeliveryEnabled,
  isDelivering,
  deliverySuccess,
  deliveryError,
  onQuoteDeliver,
}: QuoteResultActionsProps) {
  return (
    <section aria-label="견적 결과 actions" className="space-y-3">
      {kakaoDeliveryEnabled ? (
        <>
          <button
            type="button"
            onClick={onQuoteDeliver}
            disabled={isDelivering}
            aria-busy={isDelivering}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-btn bg-[var(--color-kakao-action)] px-5 text-[15px] font-extrabold text-[var(--color-kakao-ink)] shadow-card transition-colors duration-state hover:bg-[var(--color-kakao-action-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            <KakaoBubbleIcon />
            {isDelivering ? "전송 중…" : "카카오톡으로 견적서 받기"}
          </button>

          {deliverySuccess ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-[12px] border border-brand/20 bg-brand-soft p-3 text-[12px] font-semibold text-brand"
            >
              <CheckCircle2 aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
              카카오톡으로 견적서를 보냈어요. 나와의 채팅에서 확인해 주세요.
            </p>
          ) : null}

          {deliveryError ? (
            <p role="alert" className="text-[13px] font-semibold text-status-danger">
              {deliveryError}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onContractApply}
          disabled={isApplying}
          aria-busy={isApplying}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-btn bg-brand px-3 text-[14px] font-extrabold text-white transition-colors duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ClipboardCheck aria-hidden="true" size={17} />
          {isApplying ? "견적 저장 중…" : "심사 요청하기"}
        </button>

        <ChannelTalkButton
          label="상담하기"
          className="min-h-12 rounded-btn px-3 text-[14px]"
        />
      </div>

      {applyError ? (
        <p role="alert" className="text-[13px] font-semibold text-status-danger">
          {applyError}
        </p>
      ) : null}
    </section>
  );
}

function KakaoBubbleIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 2.5c-4.14 0-7.5 2.56-7.5 5.72 0 2.02 1.42 3.8 3.55 4.8l-.58 2.12c-.1.36.12.5.42.32l2.62-1.62c.49.07.99.1 1.49.1 4.14 0 7.5-2.56 7.5-5.72S14.14 2.5 10 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
