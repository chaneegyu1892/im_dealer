"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { TossPrice } from "@/components/ui/TossPrice";
import { isCustomerType, type CustomerType } from "@/constants/customer-types";
import type { QuoteScenarioDetail, FinanceCompanyQuote } from "@/types/quote";

// ─── 타입 ────────────────────────────────────────────────
type ApprovalLevel = "high" | "medium" | "low";

// ─── 헬퍼 (v1 계약 그대로) ───────────────────────────────
function getDepositRate(data: QuoteScenarioDetail) {
  const vp = data.breakdown?.vehiclePrice ?? 0;
  if (vp <= 0 || data.depositAmount <= 0) return 0;
  return Math.round((data.depositAmount / vp) * 100);
}

function estimateApproval(monthly: number, depositRate: number): ApprovalLevel {
  if (depositRate >= 20) return "high";
  if (monthly < 400_000) return "high";
  if (monthly < 700_000) return "medium";
  return "low";
}

const APPROVAL_COPY: Record<ApprovalLevel, {
  label: string;
  message: string;
  badgeClass: string;
  containerClass: string;
  iconClass: string;
}> = {
  high: {
    label: "유리",
    message: "이 조건은 심사에 유리한 편이에요",
    badgeClass: "bg-status-positive-soft text-status-positive",
    containerClass: "border-status-positive/25 bg-status-positive-soft",
    iconClass: "text-status-positive",
  },
  medium: {
    label: "보완 권장",
    message: "보증금을 추가하면 심사 가능성이 높아질 수 있어요",
    badgeClass: "bg-status-warning-soft text-status-warning",
    containerClass: "border-status-warning/25 bg-status-warning-soft",
    iconClass: "text-status-warning",
  },
  low: {
    label: "증빙 필요",
    message: "소득 증빙 또는 보증금 확대를 권장해요",
    badgeClass: "bg-status-danger-soft text-text-strong",
    containerClass: "border-status-danger/25 bg-status-danger-soft",
    iconClass: "text-status-danger",
  },
};

// ════════════════════════════════════════════════════════════
// 심사 가능성 미리보기 v2
// ════════════════════════════════════════════════════════════
export function ApprovalPreviewV2({ data }: { data: QuoteScenarioDetail }) {
  const depositRate = getDepositRate(data);
  const level = estimateApproval(data.monthlyPayment, depositRate);
  const copy = APPROVAL_COPY[level];

  return (
    <div className={cn("rounded-[20px] border p-4", copy.containerClass)}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={18} className={cn("mt-0.5 shrink-0", copy.iconClass)} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-text-strong">심사 가능성 미리보기</p>
            <span className={cn("rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold", copy.badgeClass)}>
              {copy.label}
            </span>
          </div>
          <p className="text-[13px] font-medium text-text-strong">{copy.message}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-text-body">
            실제 심사 결과는 금융사 기준, 신용도, 소득 증빙에 따라 달라질 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 금융사별 견적 v2
// ════════════════════════════════════════════════════════════
const RANK_STYLE: Record<number, { badgeClass: string; label: string }> = {
  0: { badgeClass: "bg-brand-soft text-brand", label: "최저가" },
  1: { badgeClass: "bg-status-positive-soft text-status-positive", label: "2순위" },
  2: { badgeClass: "bg-status-warning-soft text-status-warning", label: "3순위" },
  3: { badgeClass: "bg-[#F8FAFC] text-text-muted", label: "기타" },
};

export function FinanceSectionV2({ results }: { results: FinanceCompanyQuote[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!results || results.length === 0) return null;

  const sorted = [...results].sort((a, b) => a.monthlyPayment - b.monthlyPayment);
  const top2 = sorted.slice(0, 2);
  const rest = sorted.slice(2);
  const best = sorted[0];

  return (
    <div className="overflow-hidden rounded-[20px] bg-[#F8FAFC]">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-[#E5E8EB] bg-white/50 px-5 py-3.5">
        <Trophy size={13} className="text-brand" />
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-body">금융사별 견적</span>
        <span className="num ml-auto text-[11.5px] text-text-muted tabular-nums">{sorted.length}개사</span>
      </div>

      {/* 상위 2개 항상 노출 */}
      <div className="divide-y divide-[#E5E8EB] bg-white">
        {top2.map((r, i) => (
          <FinanceRowV2 key={`${r.financeCompanyName}-${i}`} result={r} rank={i} best={best} />
        ))}
      </div>

      {/* 나머지 아코디언 */}
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-[#E5E8EB] bg-white/50 py-3 text-[12px] font-bold text-text-muted transition-colors hover:bg-[#F2F4F6]"
          >
            {expanded ? (
              <>접기 <ChevronUp size={13} /></>
            ) : (
              <>나머지 {rest.length}개 금융사 더 보기 <ChevronDown size={13} /></>
            )}
          </button>
          {expanded && (
            <div className="divide-y divide-[#E5E8EB] border-t border-[#E5E8EB] bg-white">
              {rest.map((r, i) => (
                <FinanceRowV2 key={`${r.financeCompanyName}-${i}`} result={r} rank={i + 2} best={best} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FinanceRowV2({
  result,
  rank,
  best,
}: {
  result: FinanceCompanyQuote;
  rank: number;
  best: FinanceCompanyQuote;
}) {
  const isBest = rank === 0;
  const diff = result.monthlyPayment - best.monthlyPayment;
  const style = RANK_STYLE[rank] ?? RANK_STYLE[3];

  return (
    <div className={cn("flex items-center gap-3 px-5 py-3.5", isBest && "bg-brand-soft")}>
      <span className={cn("w-[52px] shrink-0 rounded-[6px] px-2 py-1 text-center text-[10.5px] font-bold", style.badgeClass)}>
        {style.label}
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-[14px]", isBest ? "font-bold text-brand" : "font-medium text-text-strong")}>
        {result.financeCompanyName}
      </span>
      <div className="flex shrink-0 flex-col items-end">
        <TossPrice won={result.monthlyPayment} size="sm" tone={isBest ? "brand" : "ink"} />
        <span className="num mt-0.5 text-[10.5px] text-text-muted tabular-nums">
          {diff > 0 ? `+${formatCurrency(diff)}` : "기준가"}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 체크포인트 v2
// ════════════════════════════════════════════════════════════
const CUSTOMER_TYPE_CHECKPOINTS: Partial<Record<CustomerType, string[]>> = {
  self_employed: [
    "개인사업자는 차량 이용 목적에 따라 비용처리와 부가세 처리 방식이 달라질 수 있어요.",
    "최종 세무 판단은 사업자 등록 상태와 실제 사용 목적을 기준으로 세무사와 확인해 주세요.",
  ],
  corporate: [
    "법인은 업무용 차량 비용처리, 업무전용 자동차보험 가입 대상, 부가세 환급 가능 여부를 함께 확인해야 해요.",
    "최종 세무 판단은 법인 회계 기준과 차량 운행 목적을 기준으로 세무사와 확인해 주세요.",
  ],
};

export function CostCheckpointV2({
  contractType,
  customerType,
}: {
  contractType: string;
  customerType?: string;
}) {
  const points =
    contractType === "인수형"
      ? ["잔존가치로 차량 최종 매입", "감가상각 비용처리 가능 (법인)"]
      : ["계약 종료 후 반납, 교체 자유", "전액 비용처리 가능 (법인/개인사업자)"];
  const customerPoints = isCustomerType(customerType)
    ? CUSTOMER_TYPE_CHECKPOINTS[customerType] ?? []
    : [];

  return (
    <div className="rounded-[20px] bg-surface-soft p-4">
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-body">체크포인트</p>
      <div className="space-y-1.5">
        {points.map((p) => (
          <p key={p} className="flex items-start gap-2 text-[12.5px] text-text-body">
            <span className="mt-0.5 text-brand">•</span>
            {p}
          </p>
        ))}
      </div>
      {customerPoints.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-body">고객 유형 안내</p>
          {customerPoints.map((p) => (
            <p key={p} className="flex items-start gap-2 text-[12.5px] text-text-body">
              <span className="mt-0.5 text-brand">•</span>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
