"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

// 마케팅 수신 동의 동의/철회 토글. 마이페이지 프로필 카드에서 사용한다.
// 철회 시 서버가 카카오 약관 동의도 함께 철회한다(best-effort).
export function MarketingConsentToggle({ initial }: { initial: boolean }) {
  const [consent, setConsent] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (saving) return;
    const next = !consent;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/marketing-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "변경에 실패했습니다.");
      }
      setConsent(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="font-semibold text-text-muted">마케팅 수신 동의</span>
        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={consent}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-border-strong bg-surface px-3 text-[12px] font-extrabold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait disabled:opacity-60"
        >
          {consent ? (
            <>
              <Check size={13} strokeWidth={2.6} className="text-status-positive" />
              동의함
              <span className="text-text-muted">· 철회</span>
            </>
          ) : (
            <>
              <X size={13} strokeWidth={2.6} className="text-text-muted" />
              미동의
              <span className="text-text-muted">· 동의</span>
            </>
          )}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-right text-[11px] font-semibold text-status-danger">{error}</p> : null}
    </div>
  );
}
