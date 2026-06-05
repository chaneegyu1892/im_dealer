"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface MemberGateProps {
  /** true 면 children 을 블러 + 비활성화하고 로그인 유도 오버레이를 띄운다. */
  locked: boolean;
  children: ReactNode;
  /** 그리드 배치 등 레이아웃용 클래스 — 잠금 여부와 무관하게 래퍼에 항상 적용된다. */
  className?: string;
  message?: string;
  /**
   * 로그인 CTA 클릭 시 동작을 페이지별로 주입한다(예: 견적 화면은 현재 상태를 저장 후 이동).
   * 미지정 시 현재 경로(path+query)를 next 로 보존해 /login 으로 이동한다.
   */
  onLogin?: () => void;
}

/**
 * 회원 전용 콘텐츠 게이트.
 * - locked=false: 블러/오버레이 없이 children 노출 (래퍼 div 는 레이아웃 보존을 위해 유지).
 * - locked=true: children 을 블러·비활성화하고 위에 카카오 로그인 유도 오버레이를 띄운다.
 *
 * 표시(UX)용 게이트다. 데이터 자체는 이미 클라이언트에 있으므로 보안 경계가 아니다.
 */
export function MemberGate({
  locked,
  children,
  className,
  message = "월 납입금을 낮추고 싶으시다면 로그인 해주세요",
  onLogin,
}: MemberGateProps) {
  const router = useRouter();

  const goLogin = () => {
    if (onLogin) {
      onLogin();
      return;
    }
    // path + query 전체를 next 로 보존 → 로그인 후 정확히 같은 견적/추천 화면으로 복귀.
    const next =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden={locked}
        className={cn(
          "transition-[filter,opacity] duration-300",
          locked && "blur-[6px] opacity-60 pointer-events-none select-none"
        )}
      >
        {children}
      </div>

      {locked && (
        <button
          type="button"
          onClick={goLogin}
          aria-label={message}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[10px] bg-white/40 px-4 text-center backdrop-blur-[2px] transition-colors hover:bg-white/55"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Lock size={16} className="text-primary" />
          </span>
          <span className="text-[12px] font-semibold leading-snug text-ink">
            {message}
          </span>
          <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-[#FEE500] px-3 py-1.5 text-[12px] font-semibold text-[#1A1A2E]">
            카카오로 로그인 →
          </span>
        </button>
      )}
    </div>
  );
}
