"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface WelcomeFormProps {
  readonly defaultName: string;
  readonly defaultPhone: string;
  readonly next: string;
}

export function WelcomeForm({ defaultName, defaultPhone, next }: WelcomeFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [referralCode, setReferralCode] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          marketingConsent,
          // 추천인 코드는 선택값 — 대문자로 정규화하고 빈 값은 요청에 싣지 않는다.
          ...(referralCode.trim() ? { referralCode: referralCode.trim().toUpperCase() } : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error ?? "저장 중 오류가 발생했습니다. 다시 시도해주세요.");
        setSubmitting(false);
        return;
      }
      // 저장 성공 → 원래 목적지로. replace 로 뒤로가기 시 폼으로 돌아오지 않게 한다.
      router.replace(next);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <main className="home-showroom-scope min-h-screen bg-app-bg px-4 py-8 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:py-14 md:pb-16">
      <div className="mx-auto flex min-h-[calc(100dvh-96px)] w-full max-w-[440px] flex-col justify-center">
        <section className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-card">
          <form onSubmit={handleSubmit} className="px-5 pb-6 pt-7 sm:px-6">
            <p className="mb-3 inline-flex rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-extrabold text-brand">
              간편가입
            </p>
            <h1 className="break-keep text-[26px] font-extrabold leading-[1.18] tracking-[-0.04em] text-text-strong sm:text-[30px]">
              마지막으로
              <br />
              연락받으실 정보를 알려주세요
            </h1>
            <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.65] text-text-body">
              상담과 견적 안내를 위해 이름과 연락처가 필요합니다.
            </p>

            <div className="mt-7 grid gap-4">
              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-text-body">이름 (실명)</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={20}
                  autoComplete="name"
                  placeholder="홍길동"
                  className="min-h-[52px] rounded-[16px] border border-border-subtle bg-surface-soft px-4 text-[16px] font-semibold text-text-strong outline-none transition-colors focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-focus-ring/20"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-text-body">전화번호</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  placeholder="010-1234-5678"
                  className="min-h-[52px] rounded-[16px] border border-border-subtle bg-surface-soft px-4 text-[16px] font-semibold text-text-strong outline-none transition-colors focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-focus-ring/20"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[13px] font-bold text-text-body">
                  추천인 코드 <span className="font-bold text-text-muted">(선택)</span>
                </span>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  placeholder="추천인 코드(선택)"
                  className="min-h-[52px] rounded-[16px] border border-border-subtle bg-surface-soft px-4 text-[16px] font-semibold text-text-strong outline-none transition-colors focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-focus-ring/20"
                />
              </label>

              <button
                type="button"
                onClick={() => setMarketingConsent((v) => !v)}
                aria-pressed={marketingConsent}
                className="flex items-start gap-2.5 rounded-[16px] border border-border-subtle bg-surface-soft px-3.5 py-3 text-left transition-colors hover:bg-surface"
              >
                <CheckCircle2
                  size={20}
                  className={marketingConsent ? "shrink-0 text-brand" : "shrink-0 text-text-muted/40"}
                />
                <span className="text-[13px] font-semibold leading-relaxed text-text-body">
                  혜택·이벤트 알림 수신 동의{" "}
                  <span className="font-bold text-text-muted">(선택)</span>
                </span>
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-[12px] bg-status-danger-soft px-3.5 py-2.5 text-[13px] font-semibold text-status-danger">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              disabled={submitting}
              className="mt-6 min-h-[52px] rounded-[16px] text-[16px] font-extrabold"
            >
              {submitting ? "저장 중…" : "시작하기"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
