"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// 루트 레이아웃 자체에서 발생한 에러를 잡는 최후 방어선.
// (일반 error.tsx 는 레이아웃 하위만 커버 — global-error 는 <html>/<body> 를 직접 렌더한다.)
// 레이아웃 밖에서 렌더되므로 전역 CSS 에 의존하지 않도록 inline 스타일을 사용한다.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Root Global Error]", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, 'Noto Sans KR', sans-serif",
          background: "#F8F9FC",
          color: "#1A1A2E",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: "360px", width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 8px" }}>
            문제가 발생했습니다
          </h1>
          <p
            style={{
              fontSize: "14px",
              lineHeight: 1.6,
              color: "#5A6178",
              margin: "0 0 24px",
            }}
          >
            일시적인 오류로 페이지를 표시하지 못했습니다.
            <br />
            잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#fff",
              background: "#000666",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          {error.digest && (
            <p
              style={{
                marginTop: "24px",
                fontSize: "11px",
                color: "#9BA4C0",
              }}
            >
              오류 코드: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
