"use client";

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
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FC] px-4">
      {/* 로고 */}
      <div className="mb-8 text-center">
        <p className="text-[28px] font-bold text-[#000666] tracking-tight">아임딜러</p>
        <p className="text-[14px] text-[#9BA4C0] mt-1">장기렌트 · 리스 전문 플랫폼</p>
      </div>

      {/* 카드 */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-card p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-[20px] font-semibold text-[#1A1A2E]">로그인 / 회원가입</h1>
          <p className="text-[13px] text-[#9BA4C0]">
            소셜 계정으로 간편하게 시작하세요
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <button
          type="button"
          onClick={handleKakaoLogin}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#FEE500] hover:bg-[#F5DC00] active:scale-[0.98] transition-all duration-150 py-3.5 font-semibold text-[#1A1A2E] text-[15px]"
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

        <p className="text-center text-[11px] text-[#9BA4C0] leading-relaxed">
          로그인 시 서비스 이용약관 및 개인정보처리방침에
          <br />동의하는 것으로 간주됩니다.
        </p>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2C5.582 2 2 4.784 2 8.213c0 2.177 1.38 4.09 3.47 5.195l-.88 3.278a.25.25 0 0 0 .375.275L9.1 14.4c.298.035.6.053.9.053 4.418 0 8-2.784 8-6.213S14.418 2 10 2Z"
        fill="#1A1A2E"
      />
    </svg>
  );
}
