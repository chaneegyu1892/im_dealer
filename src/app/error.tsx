"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[Global Error]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-app-bg px-4 py-12 text-text-body">
      <div className="w-full max-w-md rounded-card-lg border border-border-subtle bg-surface p-6 text-center shadow-card md:p-8">
        {/* 아이콘 */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-status-danger-soft">
          <AlertCircle size={24} className="text-status-danger" />
        </div>

        {/* 메시지 */}
        <h1 className="mb-2 text-[22px] font-extrabold text-text-strong">
          문제가 발생했습니다
        </h1>
        <p className="mb-6 text-[14px] leading-relaxed text-text-body">
          페이지를 불러오는 중 오류가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {/* 액션 */}
        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn bg-brand px-5 text-[14px] font-bold text-white transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <RefreshCw size={16} />
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-btn border border-border-subtle bg-surface-soft px-5 text-[14px] font-bold text-text-strong transition-all duration-state hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <Home size={16} />
            홈으로
          </Link>
        </div>

        {/* 에러 다이제스트 (디버깅용) */}
        {error.digest && (
          <p className="mt-8 text-[11px] text-text-muted">
            오류 코드: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
