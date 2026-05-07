"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

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
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl px-6 pt-6 pb-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full text-[#9BA4C0] hover:bg-[#F4F5F8] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center mt-2">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 15a3 3 0 100-6 3 3 0 000 6zm6.7-3a6.7 6.7 0 11-13.4 0 6.7 6.7 0 0113.4 0z"
                stroke="#D97706"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2 id="login-required-title" className="text-[18px] font-bold text-[#1A1A2E]">
            로그인이 필요해요
          </h2>
          <p className="mt-2 text-[13px] text-[#6B7399] leading-relaxed">
            견적서 PDF 다운로드는 회원만 이용할 수 있어요.
            <br />
            카카오톡으로 빠르게 시작해보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={onKakaoLogin}
          className="mt-6 w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#FEE500] hover:bg-[#F5DC00] active:scale-[0.98] transition-all duration-150 py-3.5 font-semibold text-[#1A1A2E] text-[15px]"
        >
          <KakaoIcon />
          카카오톡으로 로그인하기
        </button>

        <p className="mt-4 text-center text-[11px] text-[#9BA4C0] leading-relaxed">
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
        fill="#1A1A2E"
      />
    </svg>
  );
}
