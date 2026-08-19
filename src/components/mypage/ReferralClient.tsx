"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, Share2, Users } from "lucide-react";
import type { ReferralProgressItem } from "@/lib/referral/progress";
import { REFERRAL_REDEEM_PATH } from "@/lib/referral/pending-code";
import { ReferralProgress } from "./ReferralProgress";

interface ReferralClientProps {
  readonly code: string;
  readonly shareUrl: string;
  readonly monthCount: number;
  readonly monthCap: number;
  readonly totalCount: number;
  readonly memberName: string;
  readonly progressItems: ReferralProgressItem[];
}

export function ReferralClient({
  code,
  shareUrl,
  monthCount,
  monthCap,
  totalCount,
  memberName,
  progressItems,
}: ReferralClientProps) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  async function copy(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // clipboard 실패 시 선택 영역으로 폴백하지 않고 조용히 무시
    }
  }

  async function nativeShare() {
    if (typeof navigator.share !== "function") {
      await copy(shareUrl, "link");
      return;
    }
    try {
      await navigator.share({
        title: "아임딜러 추천 초대",
        text: `${memberName}님이 아임딜러로 초대했어요. 가입 시 추천 코드 ${code} 를 입력하면 혜택이 적용됩니다.`,
        url: shareUrl,
      });
    } catch {
      // 사용자가 공유를 취소한 경우 등
    }
  }

  const remaining = Math.max(0, monthCap - monthCount);

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-6 md:py-12">
      <section className="mb-8">
        <p className="mb-2 text-[13px] font-extrabold text-brand">REFERRAL</p>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-text-strong md:text-[34px]">
          추천인 초대
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-text-body">
          고유 링크나 코드를 공유하면, 친구가 가입을 완료할 때 쿠폰 혜택이 활성화됩니다.
        </p>
      </section>

      <section className="mb-5 rounded-card border border-border-subtle bg-surface p-5 shadow-card md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand">
            <Users size={20} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-extrabold text-text-strong">내 추천 코드</h2>
            <p className="mt-3 font-mono text-[32px] font-extrabold tracking-[0.12em] text-brand">
              {code}
            </p>
            <button
              type="button"
              onClick={() => void copy(code, "code")}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-btn border border-border-strong bg-surface px-4 text-[13px] font-extrabold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
            >
              {copied === "code" ? <Check size={15} /> : <Copy size={15} />}
              {copied === "code" ? "복사됨" : "코드 복사"}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-card border border-border-subtle bg-surface p-5 shadow-card md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand">
            <Link2 size={20} strokeWidth={2.1} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-extrabold text-text-strong">내 추천 링크</h2>
            <p className="mt-2 break-all text-[13px] font-semibold leading-5 text-text-body">
              {shareUrl}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copy(shareUrl, "link")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-btn border border-border-strong bg-surface px-4 text-[13px] font-extrabold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
              >
                {copied === "link" ? <Check size={15} /> : <Copy size={15} />}
                {copied === "link" ? "복사됨" : "링크 복사"}
              </button>
              <button
                type="button"
                onClick={() => void nativeShare()}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-btn bg-brand px-4 text-[13px] font-extrabold text-white transition-colors hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
              >
                <Share2 size={15} />
                공유하기
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-border-subtle bg-surface-soft p-4">
          <p className="text-[12px] font-bold text-text-muted">이번 달 성공 추천</p>
          <p className="mt-1 text-[24px] font-extrabold tabular-nums text-text-strong">
            {monthCount}
            <span className="text-[14px] font-bold text-text-muted"> / {monthCap}</span>
          </p>
          <p className="mt-1 text-[12px] font-semibold text-text-body">
            이번 달 {remaining}회 더 가능
          </p>
        </div>
        <div className="rounded-card border border-border-subtle bg-surface-soft p-4">
          <p className="text-[12px] font-bold text-text-muted">누적 성공 추천</p>
          <p className="mt-1 text-[24px] font-extrabold tabular-nums text-text-strong">
            {totalCount}
            <span className="text-[14px] font-bold text-text-muted"> 명</span>
          </p>
        </div>
      </section>

      <ReferralProgress items={progressItems} />

      <section className="rounded-card border border-border-subtle bg-surface p-5 text-[13px] leading-6 text-text-body md:p-6">
        <h2 className="mb-2 text-[15px] font-extrabold text-text-strong">이용 안내</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>친구가 추천 링크 또는 코드로 가입을 완료하면 쿠폰이 지급됩니다.</li>
          <li>자기 자신 추천은 인정되지 않습니다.</li>
          <li>추천인은 월 최대 {monthCap}회까지 인정됩니다. (한국 시간 기준)</li>
          <li>
            이미 가입한 회원은{" "}
            <Link
              href={REFERRAL_REDEEM_PATH}
              className="font-extrabold text-brand underline-offset-4 hover:underline"
            >
              쿠폰함에서 입력
            </Link>
            해 주세요.
          </li>
        </ul>
      </section>
    </div>
  );
}
