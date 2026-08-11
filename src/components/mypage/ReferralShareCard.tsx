"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { openChannelTalk } from "@/lib/channel-talk";
import { cn } from "@/lib/utils";

interface ReferralShareCardProps {
  code: string;
  link: string;
}

/**
 * 추천인 코드·링크의 공유 인터랙션(복사 + 상담 진입).
 * 코드/링크 값은 SSR 에서 받아 클라이언트에서 새로 생성하지 않는다.
 */
export function ReferralShareCard({ code, link }: ReferralShareCardProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // 클립보드 미지원(비보안 컨텍스트 등) — 값이 화면에 보이므로 복사 실패를 조용히 넘긴다.
      setCopied(false);
      return;
    }
    window.setTimeout(() => setCopied(false), 2000);
  }

  function contact() {
    openChannelTalk();
  }

  return (
    <section className="rounded-card border border-brand/25 bg-brand-soft p-5 md:p-6">
      <p className="mb-1 text-[13px] font-extrabold text-brand">MY REFERRAL</p>
      <h2 className="text-[22px] font-extrabold text-text-strong md:text-[26px]">
        추천인 페이지
      </h2>
      <p className="mt-2 text-[14px] leading-6 text-text-body">
        내 추천 코드와 공유 링크를 친구에게 알려주세요. 추천받은 분과 추천인이
        모두 보상을 받아요.
      </p>

      <div className="mt-5 flex items-center gap-3 rounded-card border border-border-subtle bg-surface px-4 py-3.5">
        <span className="font-mono text-[26px] font-extrabold tracking-[0.12em] text-text-strong">
          {code}
        </span>
        <span className="min-w-0 flex-1 truncate text-right text-[13px] font-bold text-text-muted">
          {link}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn bg-brand px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {copied ? <Check size={16} strokeWidth={2.4} /> : <Copy size={16} strokeWidth={2.2} />}
          {copied ? "링크를 복사했어요" : "공유 링크 복사"}
        </button>
        <button
          type="button"
          onClick={contact}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-btn px-4",
            "bg-surface text-[13px] font-extrabold text-text-strong",
            "border border-border-strong transition-colors hover:bg-surface-soft",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
          )}
        >
          <MessageCircle size={16} strokeWidth={2.2} />
          상담하기
        </button>
      </div>
      <p className="mt-3 text-[12px] font-semibold text-text-muted">
        추천 현황이 궁금하면 상담하기로 문의해 주세요.
      </p>
    </section>
  );
}
