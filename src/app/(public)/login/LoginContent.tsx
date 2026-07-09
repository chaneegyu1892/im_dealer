"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CarFront, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") ?? "/";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(next);
    });
  }, [next, router]);

  async function handleKakaoLogin() {
    const supabase = createClient();
    const redirectOrigin = getAuthRedirectOrigin();
    const redirectTo = `${redirectOrigin}/auth/callback?next=${encodeURIComponent(next)}`;

    // phone_number 는 카카오 비즈니스 앱 + 전화번호 동의항목 검수 통과 후에만 요청해야 한다.
    // 검수 전에 요청하면 로그인 자체가 깨지므로 env 플래그로 제어한다(기본 off = 기존 동작).
    const scope =
      process.env.NEXT_PUBLIC_KAKAO_REQUEST_PHONE === "true"
        ? "profile_nickname profile_image phone_number"
        : "profile_nickname profile_image";

    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        scopes: scope,
        queryParams: {
          scope,
        },
      },
    });
  }

  return (
    <main className="home-showroom-scope min-h-screen bg-app-bg px-4 py-8 pb-[calc(112px+env(safe-area-inset-bottom,0px))] md:py-14 md:pb-16">
      <div className="mx-auto flex min-h-[calc(100dvh-96px)] w-full max-w-[440px] flex-col justify-center">
        <section className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-card">
          <div className="relative px-5 pb-6 pt-7 sm:px-6">
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
                <h1 className="break-keep text-[30px] font-extrabold leading-[1.16] tracking-[-0.04em] text-text-strong sm:text-[34px]">
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
                className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#FEE500] px-5 text-[16px] font-extrabold text-[#191919] shadow-card transition-all duration-state hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/30 active:scale-[0.98]"
              >
                <KakaoIcon />
                카카오로 시작하기
              </button>

              <p className="mt-5 break-keep text-center text-[12px] leading-relaxed text-text-muted">
                로그인 시{" "}
                <Link href="/terms" className="font-bold text-text-body underline-offset-4 hover:underline">
                  이용약관
                </Link>{" "}
                및{" "}
                <Link href="/privacy" className="font-bold text-text-body underline-offset-4 hover:underline">
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

function getAuthRedirectOrigin() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/+$/, "");
  }

  return window.location.origin;
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
