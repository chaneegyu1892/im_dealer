"use client";

import type { ScrapeJobStatus as JobStatus } from "@/types/scraper";

interface Props {
  status: JobStatus;
  error?: string | null;
  humanPrompt?: string | null;
  warningCount?: number;
  onCancel: () => void;
  onResume: () => void;
  onDismiss: () => void;
}

const LABEL: Record<JobStatus, string> = {
  pending: "대기 중 — 워커가 작업을 가져오길 기다립니다",
  running: "수집 중 — 자동 브라우저가 로그인·수집을 진행합니다",
  needs_human: "사람 인증 필요",
  completed: "수집 완료 — 아래 표에 초안이 채워졌습니다. 검토 후 저장하세요",
  failed: "수집 실패",
  canceled: "취소됨",
};

export default function ScrapeJobStatus({
  status,
  error,
  humanPrompt,
  warningCount = 0,
  onCancel,
  onResume,
  onDismiss,
}: Props) {
  const active = status === "pending" || status === "running" || status === "needs_human";
  const tone =
    status === "failed"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "needs_human"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "completed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-[#D7DBF0] bg-[#F0F1FA] text-[#3A41C8]";

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {active && status !== "needs_human" && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          <p className="text-sm font-semibold">{LABEL[status]}</p>
        </div>
        <div className="flex items-center gap-2">
          {status === "needs_human" && (
            <button
              type="button"
              onClick={onResume}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
            >
              인증 완료 · 재개
            </button>
          )}
          {active && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-current/30 px-3 py-1.5 text-xs font-semibold"
            >
              취소
            </button>
          )}
          {(status === "failed" || status === "completed" || status === "canceled") && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-current/30 px-3 py-1.5 text-xs font-semibold"
            >
              닫기
            </button>
          )}
        </div>
      </div>
      {status === "needs_human" && humanPrompt && (
        <p className="mt-2 text-xs">{humanPrompt}</p>
      )}
      {status === "failed" && error && <p className="mt-2 text-xs">{error}</p>}
      {status === "completed" && warningCount > 0 && (
        <p className="mt-2 text-xs">⚠️ 경고 {warningCount}건 — 매칭 실패/누락 항목을 확인 후 수동 보정하세요.</p>
      )}
    </div>
  );
}
