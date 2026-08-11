"use client";

import { CheckCircle2, ExternalLink, Phone, TriangleAlert } from "lucide-react";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL_HREF,
} from "@/lib/contact";

interface QuoteResultActionsProps {
  readonly kakaoDeliveryEnabled: boolean;
  readonly channelTalkDelivery: boolean;
  readonly isDelivering: boolean;
  readonly deliverySuccess: boolean;
  readonly deliveryError: string | null;
  readonly onQuoteDeliver: () => void;
  /** 채널톡 경로에서 대화창을 다시 여는 콜백. 창을 닫았거나 붙여넣기를 놓친 고객용. */
  readonly onReopenChannelChat: () => void;
  /** 고객이 "보냈어요"로 전송을 자가 확인했을 때. */
  readonly onConfirmChannelSent: () => void;
  /** 고객이 전송을 확인했는지. 웹에서는 실제 전송 여부를 알 수 없어 자가 신고로 받는다. */
  readonly deliveryConfirmedBySender: boolean;
}

export function QuoteResultActions({
  kakaoDeliveryEnabled,
  channelTalkDelivery,
  isDelivering,
  deliverySuccess,
  deliveryError,
  onQuoteDeliver,
  onReopenChannelChat,
  onConfirmChannelSent,
  deliveryConfirmedBySender,
}: QuoteResultActionsProps) {
  const showQuoteDelivery = kakaoDeliveryEnabled || channelTalkDelivery;
  return (
    <section aria-label="견적 결과 actions" className="space-y-3">
      {showQuoteDelivery ? (
        <>
          <button
            type="button"
            onClick={onQuoteDeliver}
            disabled={isDelivering}
            aria-busy={isDelivering}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-btn bg-[var(--color-kakao-action)] px-5 text-[15px] font-extrabold text-[var(--color-kakao-ink)] shadow-card transition-colors duration-state hover:bg-[var(--color-kakao-action-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            <KakaoBubbleIcon />
            {isDelivering
              ? channelTalkDelivery
                ? "요청 준비 중…"
                : "전송 중…"
              : "카카오톡으로 견적서 받기"}
          </button>

          {/* 채널톡 경로는 고객이 대화창에 붙여넣고 보내야 비로소 상담사에게 닿는다.
              웹에서는 실제 전송 여부를 알 수 없으므로, 대화창을 연 직후에는 "아직 안 보냈다"고
              안내하고 고객이 '보냈어요'로 직접 넘기게 한다. 연 것만으로 완료처럼 보이면
              기다리다 이탈하고, 보낸 뒤에도 경고가 남으면 불안해진다. */}
          {deliverySuccess ? (
            channelTalkDelivery ? (
              <div
                className={`space-y-2 rounded-[12px] border p-3 ${
                  deliveryConfirmedBySender
                    ? "border-brand/20 bg-brand-soft"
                    : "border-status-warning/25 bg-status-warning-soft"
                }`}
              >
                {deliveryConfirmedBySender ? (
                  <p
                    role="status"
                    className="flex items-start gap-2 text-[12px] font-semibold text-brand"
                  >
                    <CheckCircle2 aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                    <span>
                      요청을 접수했어요. 상담사가 확인 후 카카오톡으로 견적서를 보내드려요.
                    </span>
                  </p>
                ) : (
                  <p
                    role="status"
                    className="flex items-start gap-2 text-[12px] font-semibold text-status-warning"
                  >
                    <TriangleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                    <span>
                      아직 보내지 않았어요. 카카오톡 대화창에 붙여넣기(길게 눌러 붙여넣기) 후
                      전송해 주셔야 상담사가 견적서를 보내드려요.
                    </span>
                  </p>
                )}

                <div className={deliveryConfirmedBySender ? "" : "grid grid-cols-2 gap-2"}>
                  {deliveryConfirmedBySender ? null : (
                    <button
                      type="button"
                      onClick={onConfirmChannelSent}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn bg-status-warning px-3 text-[13px] font-bold text-white transition-colors duration-state hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
                    >
                      <CheckCircle2 aria-hidden="true" size={15} />
                      보냈어요
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onReopenChannelChat}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn border bg-surface px-3 text-[13px] font-bold transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] ${
                      deliveryConfirmedBySender
                        ? "w-full border-brand/25 text-brand hover:bg-brand-soft"
                        : "border-status-warning/30 text-status-warning hover:bg-surface-soft"
                    }`}
                  >
                    <ExternalLink aria-hidden="true" size={15} />
                    대화창 다시 열기
                  </button>
                </div>
              </div>
            ) : (
              <p
                role="status"
                className="flex items-start gap-2 rounded-[12px] border border-brand/20 bg-brand-soft p-3 text-[12px] font-semibold text-brand"
              >
                <CheckCircle2 aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
                카카오톡으로 견적서를 보냈어요. 나와의 채팅에서 확인해 주세요.
              </p>
            )
          ) : null}

          {deliveryError ? (
            <p role="alert" className="text-[13px] font-semibold text-status-danger">
              {deliveryError}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="rounded-[14px] border border-border-subtle bg-surface-soft/80 p-3.5">
        <p className="text-[13px] font-extrabold text-text-strong">서류 심사는 준비 중이에요</p>
        <p className="mt-1 text-[12px] font-semibold leading-5 text-text-body">
          지금은 대표전화 또는 상담으로 바로 도와드릴게요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <a
            href={SUPPORT_PHONE_TEL_HREF}
            aria-label={`${SUPPORT_PHONE_DISPLAY} 전화 걸기`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-btn bg-brand px-3 text-[14px] font-extrabold text-white transition-colors duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <Phone aria-hidden="true" size={17} strokeWidth={2.3} />
            대표전화
          </a>
          <ChannelTalkButton
            label="상담하기"
            className="min-h-12 rounded-btn px-3 text-[14px]"
          />
        </div>
        <p className="mt-2 text-center text-[11.5px] font-bold tabular-nums text-text-muted">
          {SUPPORT_PHONE_DISPLAY}
        </p>
      </div>
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
