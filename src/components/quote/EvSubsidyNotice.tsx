// 전기차 보조금 안내 표기 (표시 전용).
// ⚠️ 이 값은 견적 계산(차량가)에 절대 반영되지 않는다. 실견적 입력값에 이미 반영되어 있어
//    시스템에서 별도로 차감하면 중복 차감이 된다. 오직 사용자 안내용으로만 노출한다.

import { Zap } from "lucide-react";

interface EvSubsidyNoticeProps {
  /** 보조금 금액(원). null/0 이하이면 아무것도 렌더링하지 않는다. */
  amount: number | null | undefined;
  /** 배경 톤. onDark = 차량 상세 hero(어두운 배경), light = 견적 화면(밝은 배경). */
  tone?: "light" | "onDark";
}

export function EvSubsidyNotice({ amount, tone = "light" }: EvSubsidyNoticeProps) {
  if (!amount || amount <= 0) return null;

  const manwon = Math.round(amount / 10000).toLocaleString();

  if (tone === "onDark") {
    return (
      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
        <span className="text-[10px] text-white/45 uppercase tracking-wide">전기차 보조금</span>
        <span className="text-[12px] font-semibold text-white">{manwon}만원</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-gradient-to-r from-primary/[0.08] to-primary/[0.02] border border-primary/15 px-4 py-3">
      <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
        <Zap size={18} strokeWidth={2.5} className="text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-primary leading-tight">전기차 보조금 지원 대상</span>
        <span className="block text-[11px] font-normal text-ink-caption">실구매가에 이미 반영된 금액</span>
      </div>
      <div className="shrink-0 text-right leading-none">
        <span className="text-[22px] font-bold text-primary tracking-tight">{manwon}</span>
        <span className="ml-0.5 text-[13px] font-semibold text-primary/80">만원</span>
      </div>
    </div>
  );
}
