"use client";

import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";

interface QuoteResultActionsProps {
  readonly onContractApply: () => void;
  readonly isApplying: boolean;
  readonly applyError: string | null;
}

export function QuoteResultActions({
  onContractApply,
  isApplying,
  applyError,
}: QuoteResultActionsProps) {
  const [isPreparationOpen, setIsPreparationOpen] = useState(false);

  return (
    <section aria-label="견적 결과 actions" className="space-y-3">
      <button
        type="button"
        onClick={() => setIsPreparationOpen(true)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-btn bg-[var(--color-kakao-action)] px-5 text-[15px] font-extrabold text-[var(--color-kakao-ink)] shadow-card transition-colors duration-state hover:bg-[var(--color-kakao-action-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
      >
        <KakaoBubbleIcon />
        견적서 전송하기
      </button>

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

      <BottomSheet
        open={isPreparationOpen}
        onClose={() => setIsPreparationOpen(false)}
        title="기능 구현 중입니다"
      >
        <div className="space-y-4">
          <p className="break-keep text-pretty text-[14px] leading-relaxed text-text-body">
            카카오톡 채널을 통한 견적서 전송 기능을 준비하고 있어요.
          </p>
          <button
            type="button"
            onClick={() => setIsPreparationOpen(false)}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-btn bg-brand px-5 text-[14px] font-extrabold text-white transition-colors duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            확인
          </button>
        </div>
      </BottomSheet>
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
