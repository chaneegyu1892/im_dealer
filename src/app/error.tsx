"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 아이콘 */}
        <div className="mx-auto w-14 h-14 rounded-full bg-error-bg flex items-center justify-center mb-5">
          <AlertCircle size={24} className="text-error-text" />
        </div>

        {/* 메시지 */}
        <h1 className="text-[22px] font-medium text-ink mb-2">
          문제가 발생했습니다
        </h1>
        <p className="text-[14px] text-ink-body leading-relaxed mb-6">
          페이지를 불러오는 중 오류가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {/* 액션 */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw size={16} />
            다시 시도
          </button>
          <Link
            href="/"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Home size={16} />
            홈으로
          </Link>
        </div>

        {/* 에러 다이제스트 (디버깅용) */}
        {error.digest && (
          <p className="mt-8 text-[11px] text-ink-caption">
            오류 코드: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
