"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function WithdrawalSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (confirmation !== "회원탈퇴" || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/me/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "회원 탈퇴를 완료하지 못했습니다.");
        return;
      }

      await createClient().auth.signOut({ scope: "local" });
      window.location.assign("/");
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6 rounded-card border border-status-danger/30 bg-surface p-5 shadow-card md:p-6">
      <h2 className="text-[17px] font-extrabold text-text-strong">회원 탈퇴</h2>
      <p className="mt-2 text-[14px] leading-6 text-text-body">
        카카오 계정 자체는 삭제되지 않습니다. 이 서비스의 회원 정보와 인증 자료가 파기되고,
        견적·계약 운영 기록은 연락처와 회원 연결을 제거한 뒤 보존됩니다.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 min-h-11 rounded-[10px] border border-status-danger px-4 text-[14px] font-bold text-status-danger"
        >
          회원 탈퇴하기
        </button>
      ) : (
        <div className="mt-4 rounded-[12px] bg-status-danger-soft p-4">
          <label htmlFor="withdrawal-confirmation" className="text-[13px] font-bold text-text-strong">
            계속하려면 &quot;회원탈퇴&quot;를 입력해 주세요.
          </label>
          <input
            id="withdrawal-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-[10px] border border-border-strong bg-surface px-3 text-[14px]"
          />
          {error ? <p className="mt-2 text-[13px] text-status-danger">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void withdraw()}
              disabled={confirmation !== "회원탈퇴" || submitting}
              className="min-h-11 rounded-[10px] bg-status-danger px-4 text-[14px] font-bold text-white disabled:opacity-40"
            >
              {submitting ? "처리 중..." : "탈퇴 확인"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
              }}
              disabled={submitting}
              className="min-h-11 rounded-[10px] border border-border-strong px-4 text-[14px] font-bold text-text-body"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
