"use client";

import { useEffect } from "react";
import { ClipboardCheck, X } from "lucide-react";

interface QuoteDeliveryGuideModalProps {
  open: boolean;
  /** 클립보드에 복사해 둔 견적 요청 메시지 — 고객이 무엇을 붙여넣을지 미리 보여준다. */
  message: string;
  onClose: () => void;
  /** "견적서 받으러 가기" — 호출부는 이 핸들러 안에서 동기적으로 대화창을 열어야 한다(팝업 차단 회피). */
  onConfirm: () => void;
}

export function QuoteDeliveryGuideModal({
  open,
  message,
  onClose,
  onConfirm,
}: QuoteDeliveryGuideModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-delivery-guide-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      {/* 배경 오버레이 */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />

      {/* 다이얼로그 */}
      <div className="relative w-full max-w-sm rounded-card-lg border border-border-subtle bg-surface px-6 pb-7 pt-6 shadow-modal">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-soft"
        >
          <X size={18} />
        </button>

        <div className="text-center mt-2">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
            <ClipboardCheck size={22} className="text-brand" />
          </div>

          <h2
            id="quote-delivery-guide-title"
            className="text-[18px] font-extrabold text-text-strong"
          >
            견적 요청 메시지를 복사했어요
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-text-body">
            카카오톡 대화창에 <strong>길게 눌러 붙여넣기</strong> 한 뒤
            <br />
            보내주시면 상담사가 견적서를 보내드려요.
          </p>
        </div>

        <p className="mt-4 whitespace-pre-line rounded-[12px] bg-surface-soft p-3 text-left text-[12px] leading-relaxed text-text-body">
          {message}
        </p>

        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-[13px] bg-[var(--color-kakao-action)] py-3.5 text-[15px] font-extrabold text-[var(--color-kakao-ink)] transition-all duration-150 hover:bg-[var(--color-kakao-action-hover)] active:scale-[0.98]"
        >
          견적서 받으러 가기
        </button>
      </div>
    </div>
  );
}
