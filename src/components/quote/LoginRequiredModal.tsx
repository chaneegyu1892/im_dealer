"use client";

import { useEffect } from "react";
import { LockKeyhole, X } from "lucide-react";

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onKakaoLogin: () => void;
}

export function LoginRequiredModal({ open, onClose, onKakaoLogin }: LoginRequiredModalProps) {
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
      aria-labelledby="login-required-title"
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-status-warning-soft">
            <LockKeyhole size={22} className="text-status-warning" />
          </div>

          <h2 id="login-required-title" className="text-[18px] font-extrabold text-text-strong">
            로그인이 필요해요
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-text-body">
            견적서 PDF 다운로드는 회원만 이용할 수 있어요.
            <br />
            카카오톡으로 빠르게 시작해보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={onKakaoLogin}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-[13px] bg-status-warning-soft py-3.5 text-[15px] font-extrabold text-status-warning transition-all duration-150 hover:bg-status-warning-soft/80 active:scale-[0.98]"
        >
          <KakaoIcon />
          카카오톡으로 로그인하기
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-text-muted">
          로그인하시면 입력하신 견적이 그대로 유지된 채로 돌아옵니다.
        </p>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3C5.58 3 2 5.79 2 9.21c0 2.18 1.5 4.09 3.74 5.16-.16.59-.59 2.13-.67 2.46-.1.41.15.4.32.29.13-.09 2.1-1.43 2.95-2.01.55.08 1.1.12 1.66.12 4.42 0 8-2.79 8-6.21S14.42 3 10 3z"
        fill="currentColor"
      />
    </svg>
  );
}
