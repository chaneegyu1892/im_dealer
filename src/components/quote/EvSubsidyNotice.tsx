// 전기차 보조금 안내 표기 (표시 전용).
// ⚠️ 이 값은 견적 계산(차량가)에 절대 반영되지 않는다. 실견적 입력값에 이미 반영되어 있어
//    시스템에서 별도로 차감하면 중복 차감이 된다. 오직 사용자 안내용으로만 노출한다.
//
// 보조금은 트림(Trim) 단위로 관리된다.
//  - amount: 트림이 선택된 화면(견적 페이지)에서 해당 트림의 단일 보조금.
//  - range : 트림 미선택 화면(차량 상세 hero 등)에서 노출 트림들의 최소~최대 범위.
//    range 가 주어지면 amount 보다 우선한다.

import { Zap } from "lucide-react";
import { formatSubsidyManwon, type SubsidyRange } from "@/lib/ev-subsidy";

interface EvSubsidyNoticeProps {
  /** 단일 보조금 금액(원). null/0 이하이면 아무것도 렌더링하지 않는다. */
  amount?: number | null;
  /** 보조금 범위(원). 주어지면 amount 대신 "최소~최대"로 표기한다. */
  range?: SubsidyRange | null;
  /** 배경 톤. onDark = 차량 상세 hero(어두운 배경), light = 견적 화면(밝은 배경). */
  tone?: "light" | "onDark";
}

export function EvSubsidyNotice({ amount, range, tone = "light" }: EvSubsidyNoticeProps) {
  const resolved: SubsidyRange | null =
    range ?? (amount != null && amount > 0 ? { min: amount, max: amount } : null);
  if (!resolved) return null;

  const label = formatSubsidyManwon(resolved);

  if (tone === "onDark") {
    return (
      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
        <span className="text-[10px] text-white/45 uppercase tracking-wide">전기차 보조금</span>
        <span className="text-[12px] font-semibold text-white">{label}</span>
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
        <span className="text-[22px] font-bold text-primary tracking-tight">{label}</span>
      </div>
    </div>
  );
}
