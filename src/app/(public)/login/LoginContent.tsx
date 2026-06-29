"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

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

    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo,
        scopes: "profile_nickname profile_image",
        queryParams: {
          scope: "profile_nickname profile_image",
        },
      },
    });
  }

  return (
    <div className="toss-page min-h-screen bg-white flex flex-col justify-center">
      <div className="t-shell">
        {/* 로고 + 헤드라인 */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-brand">
            <Image
              src="/images/brand/main-logo.svg"
              alt="아임딜러"
              width={195}
              height={40}
              priority
              unoptimized
              className="h-6 w-auto brightness-0 invert"
            />
          </span>
          <h1 className="t-h1 mt-6">
            로그인하고
            <br />
            견적을 저장하세요
          </h1>
          <p className="t-sub mt-3">
            소셜 계정으로 간편하게 시작하세요
          </p>
        </div>

        {/* 카카오 로그인 버튼 (노란색 유지) */}
        <div className="mt-9">
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="cta bg-[#FEE500] text-[#191600] hover:bg-[#FEE500] active:bg-[#F5DC00]"
          >
            <KakaoIcon />
            카카오로 시작하기
          </button>

          {/* 네이버 (향후 추가) */}
          {/* <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#03C75A] py-3.5 font-semibold text-white text-[15px] opacity-40 cursor-not-allowed"
          >
            네이버로 시작하기
          </button> */}
        </div>

        {/* 약관 안내 */}
        <p className="mt-7 text-center text-[12px] leading-relaxed text-g2">
          로그인 시 서비스 이용약관 및 개인정보처리방침에
          <br />동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
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
        fill="#191600"
      />
    </svg>
  );
}
