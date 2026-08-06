"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CarFront, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getSafeInternalPath } from "@/lib/auth/redirect";
import { startKakaoLogin } from "@/lib/kakao/client-auth";
import { useKakaoTalkInApp } from "@/hooks/useKakaoTalkInApp";

// 같은 탭에서 자동 로그인을 한 번만 시도하기 위한 플래그.
// 탭을 닫으면 사라지므로 다음 방문에는 다시 한 번 시도한다.
const AUTO_LOGIN_FLAG = "imdealer:inapp-auto-login-attempted";

/** 프라이빗 모드 등에서 sessionStorage 접근이 던질 수 있다. 실패하면 시도한 것으로 취급해 건너뛴다. */
function hasAutoLoginAttempted(): boolean {
  try {
    return window.sessionStorage.getItem(AUTO_LOGIN_FLAG) !== null;
  } catch (error) {
    if (error instanceof Error) return true;
    throw error;
  }
}

/** 플래그 기록에 실패하면 false 를 돌려준다. 루프 방지 수단이 없는 상태로는 자동 시작하지 않는다. */
function markAutoLoginAttempted(): boolean {
  try {
    window.sessionStorage.setItem(AUTO_LOGIN_FLAG, "1");
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    throw error;
  }
}

export default function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = getSafeInternalPath(params?.get("next"));
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const { isInApp, escapeUrl } = useKakaoTalkInApp();
  // auth/callback 은 실패 시 /login?error=... 로 되돌린다. 실패 직후 자동 재시도를 막는다.
  const hasAuthError = Boolean(params?.get("error"));

  const runKakaoLogin = useCallback(async () => {
    setIsStartingLogin(true);
    setLoginError(null);
    try {
      await startKakaoLogin({ next });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      setLoginError("카카오 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsStartingLogin(false);
    }
  }, [next]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(next);
        return;
      }
      // 카톡 인앱브라우저는 크롬·사파리와 쿠키 저장소가 분리돼 있어 매번 비로그인으로 보인다.
      // 카카오 로그인은 인앱브라우저 안에서 간편로그인으로 처리되므로 자동으로 시작해준다.
      if (!isInApp || hasAuthError) return;
      if (hasAutoLoginAttempted()) return;
      if (!markAutoLoginAttempted()) return;
      void runKakaoLogin();
    });
  }, [next, router, isInApp, hasAuthError, runKakaoLogin]);

  async function handleKakaoLogin() {
    if (isStartingLogin) return;
    await runKakaoLogin();
  }

  // 개발 전용: 카카오 OAuth(운영 도메인 리다이렉트) 없이 테스트 계정으로 로그인.
  const isDev = process.env.NODE_ENV === "development";
  async function handleDevLogin(fresh = false) {
    if (isStartingLogin) return;
    setIsStartingLogin(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/dev/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fresh }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "개발용 로그인에 실패했습니다.");
      }
      // fresh 모드는 간편가입 완료 화면(/welcome)으로 유도.
      router.replace(fresh ? "/welcome" : next !== "/" ? next : "/mypage");
      router.refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "개발용 로그인에 실패했습니다.");
      setIsStartingLogin(false);
    }
  }

  return (
    <main className="home-showroom-scope min-h-screen bg-app-bg px-4 py-8 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:py-14 md:pb-16">
      <div className="mx-auto flex min-h-[calc(100dvh-96px)] w-full max-w-[440px] flex-col justify-center">
        <section className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-card">
          <div className="relative px-5 pb-6 pt-7 max-[340px]:px-4 sm:px-6">
            <div className="relative">
              <Link
                href="/"
                aria-label="홈으로 이동"
                className="inline-flex h-11 items-center rounded-[14px] border border-border-subtle bg-surface px-3 shadow-card transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30"
              >
                <Image
                  src="/images/brand/main-logo.svg"
                  alt="아임딜러"
                  width={195}
                  height={40}
                  priority
                  loading="eager"
                  unoptimized
                  className="h-6 w-auto"
                />
              </Link>

              <div className="mt-8">
                <p className="mb-3 inline-flex rounded-pill bg-brand-soft px-3 py-1.5 text-[12px] font-extrabold text-brand">
                  견적 저장
                </p>
                <h1 className="break-keep text-[30px] font-extrabold leading-[1.16] tracking-[-0.04em] text-text-strong max-[340px]:text-[27px] sm:text-[34px]">
                  로그인하고
                  <br />
                  비교한 조건을 이어서 보세요
                </h1>
                <p className="mt-3 break-keep text-[15px] font-semibold leading-[1.65] text-text-body">
                  상담 전 확인한 차량과 월 납입 조건을 계정에 안전하게 보관합니다.
                </p>
              </div>

              <div className="mt-7 grid gap-2.5">
                <Benefit icon={<CarFront size={17} />} label="선택한 차량과 견적 조건 저장" />
                <Benefit icon={<ShieldCheck size={17} />} label="본인 확인 뒤 서류 진행 연결" />
              </div>

              <button
                type="button"
                onClick={handleKakaoLogin}
                disabled={isStartingLogin}
                aria-busy={isStartingLogin}
                className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--color-kakao-action)] px-5 text-[16px] font-extrabold text-[var(--color-kakao-ink)] shadow-card transition-all duration-state hover:bg-[var(--color-kakao-action-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
              >
                <KakaoIcon />
                {isStartingLogin ? "카카오 연결 중…" : "카카오 로그인"}
              </button>

              {escapeUrl ? (
                <a
                  href={escapeUrl}
                  className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[14px] border border-border-subtle bg-surface-soft px-4 text-[13px] font-bold text-text-body transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30"
                >
                  다른 브라우저에서 열기
                </a>
              ) : null}

              {isDev ? (
                <div className="mt-3 grid gap-2 rounded-[14px] border border-dashed border-border-strong bg-surface-soft p-3">
                  <p className="text-center text-[11px] font-bold text-text-muted">🔧 개발 전용 (운영 빌드 미노출)</p>
                  <button
                    type="button"
                    onClick={() => handleDevLogin(false)}
                    disabled={isStartingLogin}
                    className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[12px] border border-border-strong bg-surface px-4 text-[13px] font-bold text-text-body transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30 disabled:cursor-wait disabled:opacity-70"
                  >
                    개발용 로그인 → 마이페이지
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDevLogin(true)}
                    disabled={isStartingLogin}
                    className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[12px] border border-border-strong bg-surface px-4 text-[13px] font-bold text-text-body transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30 disabled:cursor-wait disabled:opacity-70"
                  >
                    개발용 로그인 → 간편가입 흐름(/welcome)
                  </button>
                </div>
              ) : null}

              {loginError ? (
                <p
                  role="alert"
                  className="mt-3 rounded-[14px] border border-status-danger/20 bg-status-danger-soft px-4 py-3 text-[13px] font-semibold leading-relaxed text-status-danger"
                >
                  {loginError}
                </p>
              ) : null}

              <p className="mt-5 break-keep text-center text-[12px] leading-relaxed text-text-muted">
                로그인 시{" "}
                <Link
                  href="/terms"
                  className="inline-flex min-h-11 items-center px-1 font-bold text-text-body underline-offset-4 hover:underline"
                >
                  이용약관
                </Link>{" "}
                및{" "}
                <Link
                  href="/privacy"
                  className="inline-flex min-h-11 items-center px-1 font-bold text-text-body underline-offset-4 hover:underline"
                >
                  개인정보처리방침
                </Link>
                에 동의한 것으로 간주됩니다.
              </p>
            </div>
          </div>

          <Link
            href="/cars"
            className="flex min-h-14 items-center justify-between border-t border-border-subtle bg-surface-soft px-5 text-[14px] font-extrabold text-text-body transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-focus-ring/25 sm:px-6"
          >
            로그인 없이 차량 먼저 둘러보기
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </main>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2C5.582 2 2 4.784 2 8.213c0 2.177 1.38 4.09 3.47 5.195l-.88 3.278a.25.25 0 0 0 .375.275L9.1 14.4c.298.035.6.053.9.053 4.418 0 8-2.784 8-6.213S14.418 2 10 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Benefit({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[16px] border border-border-subtle bg-surface-soft px-3.5 py-3 text-[13px] font-bold text-text-body">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-surface text-brand">
        {icon}
      </span>
      {label}
    </div>
  );
}
