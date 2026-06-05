"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatMonthly } from "@/lib/utils";
import {
  Building2, ChevronDown, ChevronUp, Trophy, HelpCircle, ShieldCheck, TrendingDown,
} from "lucide-react";
import { isCustomerType, type CustomerType } from "@/constants/customer-types";
import type { QuoteScenarioDetails, QuoteScenarioDetail, FinanceCompanyQuote } from "@/types/quote";
import { useAuthUser } from "@/hooks/useAuthUser";
import { MemberGate } from "@/components/auth/MemberGate";

// ─── 타입 ─────────────────────────────────────────────────
type ApprovalPreviewLevel = "high" | "medium" | "low";
export type CostMode = "none" | "initial";
type CostType = "deposit" | "prepay";

// ─── 상수 ─────────────────────────────────────────────────
const PRESET_RATES = [10, 20, 30] as const;
const RATE_MAX = 30;

const APPROVAL_COPY: Record<ApprovalPreviewLevel, {
  label: string; message: string;
  badgeClass: string; containerClass: string; iconClass: string;
}> = {
  high: {
    label: "유리",
    message: "이 조건은 심사에 유리한 편입니다",
    badgeClass: "bg-[#ECFDF5] text-[#047857]",
    containerClass: "bg-[#F0FDF4] border-[#BBF7D0]",
    iconClass: "text-[#059669]",
  },
  medium: {
    label: "보완 권장",
    message: "보증금을 추가하면 심사 가능성이 높아질 수 있습니다",
    badgeClass: "bg-[#FFFBEB] text-[#B45309]",
    containerClass: "bg-[#FFFBEB] border-[#FDE68A]",
    iconClass: "text-[#D97706]",
  },
  low: {
    label: "증빙 필요",
    message: "소득 증빙 또는 보증금 확대를 권장합니다",
    badgeClass: "bg-[#FFF7ED] text-[#C2410C]",
    containerClass: "bg-[#FFF7ED] border-[#FED7AA]",
    iconClass: "text-[#EA580C]",
  },
};

const COST_TYPE_INFO = {
  deposit: {
    label: "보증금",
    subLabel: "계약 후 반환",
    tooltip: "계약 시 납부하는 담보금. 월 납입금을 낮추며 계약 종료 후 전액 반환됩니다.",
  },
  prepay: {
    label: "선납금",
    subLabel: "미리 납부",
    tooltip: "렌트 기간 일부 금액을 미리 납부. 반환되지 않으나 월 납입금을 크게 낮춥니다.",
  },
};

// ─── 헬퍼 ─────────────────────────────────────────────────
function getDepositRate(data: QuoteScenarioDetail) {
  const vp = data.breakdown?.vehiclePrice ?? 0;
  if (vp <= 0 || data.depositAmount <= 0) return 0;
  return Math.round((data.depositAmount / vp) * 100);
}

function estimateApproval(monthly: number, depositRate: number): ApprovalPreviewLevel {
  if (depositRate >= 20) return "high";
  if (monthly < 400_000) return "high";
  if (monthly < 700_000) return "medium";
  return "low";
}

// ─── Props ────────────────────────────────────────────────
interface Props {
  scenarios: QuoteScenarioDetails;
  customRates?: { depositRate: number; prepayRate: number };
  onCustomRatesChange?: (rates: { depositRate: number; prepayRate: number }) => void;
  isRecalculating?: boolean;
  customerType?: string;
  /** 초기비용 없음으로 돌아갈 때 호출 (베이스 시나리오 복원) */
  onReset?: () => void;
  /** 비회원 게이트의 로그인 CTA 클릭 시 호출 — 견적 화면 상태를 저장 후 /login 으로 이동 */
  onMemberLogin?: () => void;
  /** 초기비용 패널 펼침 상태 — 부모가 제어(저장본 복원 시 직전 상태 그대로 복원) */
  costMode?: CostMode;
  /** 초기비용 패널 펼침 상태 변경 알림 */
  onCostModeChange?: (mode: CostMode) => void;
  /** @deprecated 3탭 구조 제거로 사용 안 함 */
  onTabChange?: (tab: string) => void;
}

// ════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ════════════════════════════════════════════════════════════
export function QuoteBreakdownTabs({
  scenarios,
  customRates,
  onCustomRatesChange,
  isRecalculating = false,
  customerType,
  onReset,
  onMemberLogin,
  costMode = "none",
  onCostModeChange,
}: Props) {
  // 보증/선납 탭은 저장된 비율(customRates)을 따라 초기값을 맞춘다(복원 시 직전 탭 유지).
  const [costType, setCostType] = useState<CostType>(() =>
    (customRates?.prepayRate ?? 0) > 0 ? "prepay" : "deposit"
  );
  const [directMode, setDirectMode] = useState(false);
  const [directValue, setDirectValue] = useState("");
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [financeExpanded, setFinanceExpanded] = useState(false);

  // 비회원에게는 초기비용(보증/선납) 설정을 블러 처리한다. user 는 null 로 시작 → 로딩 중엔 잠금 기본값.
  const { user } = useAuthUser();
  const locked = !user;

  // 항상 standard 시나리오 기반
  const data = scenarios.standard;

  const depositRate = customRates?.depositRate ?? 0;
  const prepayRate = customRates?.prepayRate ?? 0;
  const activeRate = costType === "deposit" ? depositRate : prepayRate;

  // ── 모드 전환 (제어 상태 — 부모에 알림) ───────────────────
  const switchMode = (mode: CostMode) => {
    if (mode === "none") {
      onCustomRatesChange?.({ depositRate: 0, prepayRate: 0 });
      onReset?.();
    }
    onCostModeChange?.(mode);
  };

  const switchCostType = (type: CostType) => {
    setCostType(type);
    setDirectMode(false);
    setDirectValue("");
    onCustomRatesChange?.({ depositRate: 0, prepayRate: 0 });
  };

  const applyRate = (rate: number) => {
    setDirectMode(false);
    if (costType === "deposit") {
      onCustomRatesChange?.({ depositRate: rate, prepayRate: 0 });
    } else {
      onCustomRatesChange?.({ depositRate: 0, prepayRate: rate });
    }
  };

  // ── 절감 정보 계산 ─────────────────────────────────────
  const discountInfo = (() => {
    const bd = data.breakdown;
    if (!bd) return null;

    if (costType === "deposit" && data.depositAmount > 0 && bd.depositDiscount > 0) {
      const annual = bd.depositDiscount * 12;
      return {
        monthly: bd.depositDiscount,
        effectiveRate: (annual / data.depositAmount) * 100,
        amount: data.depositAmount,
        returned: true,
        typeLabel: "보증금",
      };
    }
    if (costType === "prepay" && data.prepayAmount > 0 && bd.prepayAdjust < 0) {
      const monthly = Math.abs(bd.prepayAdjust);
      const annual = monthly * 12;
      return {
        monthly,
        effectiveRate: (annual / data.prepayAmount) * 100,
        amount: data.prepayAmount,
        returned: false,
        typeLabel: "선납금",
      };
    }
    return null;
  })();

  return (
    <div className="space-y-4">

      {/* ① 납입 방식 토글 */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          {
            mode: "none" as CostMode,
            title: "없음",
            desc: "보증금·선납금 없이 시작",
          },
          {
            mode: "initial" as CostMode,
            title: "있음",
            desc: "초기 납부로 월납입 절감",
          },
        ].map(({ mode, title, desc }) => {
          const isActive = costMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => switchMode(mode)}
              className={cn(
                "py-3.5 px-4 rounded-[14px] border-2 text-left transition-all duration-200",
                isActive
                  ? "border-primary bg-primary-100"
                  : "border-[#E8E8E8] bg-white hover:border-primary/30"
              )}
            >
              <span className="block text-[10px] font-medium uppercase tracking-wider text-ink-caption mb-0.5">
                초기비용
              </span>
              <span className={cn("block text-[15px] font-semibold", isActive ? "text-primary" : "text-ink")}>
                {title}
              </span>
              <span className="block text-[11px] text-ink-caption mt-0.5">{desc}</span>
            </button>
          );
        })}
      </div>

      {/* ② 초기비용 설정 — 비회원은 블러 + 카카오 로그인 유도 */}
      {costMode === "initial" && onCustomRatesChange && (
        <MemberGate locked={locked} onLogin={onMemberLogin}>
        <div className="rounded-[14px] border border-[#E0E4EE] bg-white p-4 space-y-4">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-ink-label uppercase tracking-wider">초기비용 설정</p>
            <span className={cn(
              "flex items-center gap-1.5 text-[11px] text-ink-caption transition-opacity duration-200",
              isRecalculating ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
              <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              재계산 중…
            </span>
          </div>

          {/* 보증금 / 선납금 선택 */}
          <div className="flex gap-2 items-center">
            {(["deposit", "prepay"] as CostType[]).map((type) => {
              const info = COST_TYPE_INFO[type];
              const isActive = costType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => switchCostType(type)}
                  className={cn(
                    "flex-1 py-2.5 px-3 rounded-[10px] border text-left transition-all duration-150",
                    isActive ? "border-primary bg-primary/5" : "border-[#E8E8E8] bg-neutral hover:border-primary/30"
                  )}
                >
                  <span className={cn("block text-[13px] font-semibold", isActive ? "text-primary" : "text-ink")}>
                    {info.label}
                  </span>
                  <span className="block text-[10px] text-ink-caption">{info.subLabel}</span>
                </button>
              );
            })}
            <button
              type="button"
              title={COST_TYPE_INFO[costType].tooltip}
              className="p-2 rounded-full text-ink-caption hover:text-ink hover:bg-neutral transition-colors shrink-0"
              onClick={() => alert(COST_TYPE_INFO[costType].tooltip)}
            >
              <HelpCircle size={16} />
            </button>
          </div>

          {/* 프리셋 버튼 */}
          <div>
            <p className="text-[11px] text-ink-caption mb-2">
              {COST_TYPE_INFO[costType].label} 비율 선택
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyRate(0)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all duration-150",
                  activeRate === 0 && !directMode
                    ? "bg-ink text-white border-ink"
                    : "bg-white text-ink-label border-[#E0E0E0] hover:border-ink/40"
                )}
              >
                없음
              </button>
              {PRESET_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => applyRate(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all duration-150",
                    activeRate === r && !directMode
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-ink-label border-[#E0E0E0] hover:border-primary/40"
                  )}
                >
                  {r}%
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setDirectMode(true); setDirectValue(String(activeRate)); }}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all duration-150",
                  directMode
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-ink-label border-[#E0E0E0] hover:border-primary/40"
                )}
              >
                직접입력
              </button>
            </div>
          </div>

          {/* 직접 입력 필드 */}
          {directMode && (
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-[#E0E0E0] rounded-[10px] overflow-hidden bg-white focus-within:border-primary/50 transition-colors">
                <input
                  type="number"
                  min={0}
                  max={RATE_MAX}
                  value={directValue}
                  onChange={(e) => setDirectValue(e.target.value)}
                  placeholder="0"
                  className="w-20 px-3 py-2 text-[15px] font-semibold text-ink bg-transparent outline-none tabular-nums"
                />
                <span className="pr-3 text-[13px] text-ink-caption font-medium">%</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const v = Math.min(RATE_MAX, Math.max(0, parseInt(directValue) || 0));
                  applyRate(v);
                  setDirectValue(String(v));
                }}
                className="px-4 py-2 rounded-[10px] bg-primary text-white text-[12px] font-semibold hover:bg-primary/90 transition-colors"
              >
                적용
              </button>
            </div>
          )}

          {/* 슬라이더 */}
          <div className="space-y-1">
            <div className="relative h-5 flex items-center">
              <div className="absolute inset-x-0 h-[6px] rounded-full bg-[#E2E8F0] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(activeRate / RATE_MAX) * 100}%`,
                    background: "linear-gradient(90deg, #000666 0%, #6066EE 100%)",
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={RATE_MAX}
                step={1}
                value={activeRate}
                onChange={(e) => {
                  applyRate(Number(e.target.value));
                  setDirectMode(false);
                }}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
              />
              {/* 썸 표시 */}
              <div
                className="absolute w-5 h-5 rounded-full -translate-x-1/2 pointer-events-none transition-all duration-300 shadow-md"
                style={{
                  left: `${(activeRate / RATE_MAX) * 100}%`,
                  background: "#fff",
                  border: "2.5px solid #000666",
                  boxShadow: activeRate > 0 ? "0 1px 8px rgba(0,6,102,0.3)" : "0 1px 4px rgba(0,0,0,0.15)",
                }}
              />
            </div>
            {/* 클릭 가능한 눈금 레이블 */}
            <div className="flex justify-between px-0.5">
              {[0, 10, 20, 30].map((tick) => (
                <button
                  key={tick}
                  type="button"
                  onClick={() => { applyRate(tick); setDirectMode(false); }}
                  className={cn(
                    "text-[10px] font-medium transition-colors px-0.5",
                    activeRate === tick
                      ? "text-primary font-bold"
                      : "text-ink-caption hover:text-primary"
                  )}
                >
                  {tick === 0 ? "0%" : `${tick}%`}
                </button>
              ))}
            </div>
          </div>

          {/* 절감 효과 */}
          {discountInfo && (
            <div className="rounded-[10px] bg-[#EEF2FF] border border-primary/20 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                  <TrendingDown size={13} />
                  월 납입금 절감
                </span>
                <span className="text-[15px] font-bold text-primary tabular-nums">
                  −{formatCurrency(discountInfo.monthly)}/월
                </span>
              </div>
              <p className="text-[11px] text-primary/75 leading-relaxed">
                납부한 {discountInfo.typeLabel}({formatCurrency(discountInfo.amount)})의
                연간 수익률로 환산하면 약{" "}
                <span className="font-bold text-primary">{discountInfo.effectiveRate.toFixed(1)}%</span>에 해당합니다.
                {discountInfo.returned
                  ? " 보증금은 계약 종료 후 전액 반환됩니다."
                  : " 선납금은 반환되지 않으나 그만큼 매달 부담이 줄어듭니다."}
              </p>
            </div>
          )}
        </div>
        </MemberGate>
      )}

      {/* ③ 월 납입금 */}
      <div className={cn("transition-opacity duration-200", isRecalculating && "opacity-60")}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-[11px] text-ink-caption mb-0.5">월 납입금</p>
            <p className="text-[36px] md:text-[40px] font-light text-ink leading-none tabular-nums">
              {formatMonthly(data.monthlyPayment)}
            </p>
          </div>
          {data.bestFinanceCompany && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-label bg-secondary-100 border border-secondary-200 rounded-full px-2.5 py-1 mb-1">
              <Building2 size={10} className="text-secondary" />
              {data.bestFinanceCompany}
            </span>
          )}
        </div>

        {/* 수평 바 */}
        <MonthlyBar data={data} />
      </div>

      {/* ④ 계약 조건 그리드 */}
      <div className="rounded-[10px] bg-neutral p-4 grid grid-cols-2 gap-y-3 gap-x-4">
        <ConditionRow label="계약기간" value={`${data.contractMonths}개월`} />
        <ConditionRow label="약정거리" value={`연 ${(data.annualMileage / 10000).toFixed(0)}만km`} />
        {data.depositAmount > 0 && (
          <ConditionRow label="보증금" value={formatCurrency(data.depositAmount)} />
        )}
        {data.prepayAmount > 0 && (
          <ConditionRow label="선납금" value={formatCurrency(data.prepayAmount)} />
        )}
      </div>

      {/* ⑤ 심사 가능성 */}
      <ApprovalPreview data={data} />

      {/* ⑥ 금융사별 견적 */}
      {data.allFinanceResults.length >= 1 && (
        <FinanceSection
          results={data.allFinanceResults}
          expanded={financeExpanded}
          onToggle={() => setFinanceExpanded((v) => !v)}
        />
      )}

      {/* ⑦ 견적 산출 내역 */}
      {data.breakdown && data.surcharges && (
        <BreakdownSection
          data={data}
          open={breakdownOpen}
          onToggle={() => setBreakdownOpen((v) => !v)}
        />
      )}

      {/* ⑧ 체크포인트 */}
      <CostCheckpoint contractType={data.contractType} customerType={customerType} />
    </div>
  );
}

// ─── 수평 바 차트 ──────────────────────────────────────────
function MonthlyBar({ data }: { data: QuoteScenarioDetail }) {
  const { breakdown: bd, surcharges: sc, purchaseSurcharge } = data;
  if (!bd || !sc) return null;

  const vehicleShare = bd.monthlyBeforeSurcharge > 0 ? bd.monthlyBeforeSurcharge : 0;
  const financeShare = sc.totalSurcharge > 0 ? sc.totalSurcharge : 0;
  const purchaseShare = purchaseSurcharge > 0 ? purchaseSurcharge : 0;
  const total = vehicleShare + financeShare + purchaseShare;
  if (!(total > 0)) return null;

  const segments = [
    { label: "차량 대여료", value: vehicleShare, color: "#000666" },
    { label: "이자·수수료", value: financeShare, color: "#6066EE" },
    ...(purchaseShare > 0 ? [{ label: "인수 옵션비", value: purchaseShare, color: "#1A1A2E" }] : []),
  ];

  return (
    <div className="rounded-[10px] bg-neutral px-4 py-3 space-y-3">
      <p className="text-[11px] font-semibold text-ink-label uppercase tracking-wider">월 납입금 구성</p>
      {/* 수평 바 */}
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]">
        {segments.map((seg) => (
          <div
            key={seg.label}
            style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }}
            className="transition-all duration-500 first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      {/* 범례 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[11px] text-ink-caption">{seg.label}</span>
            <span className="text-[11px] font-semibold text-ink tabular-nums">
              {formatCurrency(seg.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 금융사 견적 섹션 ──────────────────────────────────────
function FinanceSection({
  results,
  expanded,
  onToggle,
}: {
  results: FinanceCompanyQuote[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const sorted = [...results].sort((a, b) => a.monthlyPayment - b.monthlyPayment);
  const top2 = sorted.slice(0, 2);
  const rest = sorted.slice(2);
  const best = sorted[0];

  return (
    <div className="rounded-[10px] border border-[#E8EAF2] overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral border-b border-[#F0F2F8]">
        <Trophy size={12} className="text-primary" />
        <span className="text-[12px] font-semibold text-ink-label uppercase tracking-wider">
          금융사별 견적
        </span>
        <span className="ml-auto text-[11px] text-ink-caption">{sorted.length}개사</span>
      </div>

      {/* 상위 2개 항상 노출 */}
      <div className="divide-y divide-[#F0F2F8] bg-white">
        {top2.map((r, i) => (
          <FinanceRow key={`${r.financeCompanyName}-${i}`} result={r} rank={i} best={best} />
        ))}
      </div>

      {/* 나머지 아코디언 */}
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={onToggle}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-neutral hover:bg-neutral-800 border-t border-[#F0F2F8] transition-colors text-[11px] font-medium text-ink-caption"
          >
            {expanded ? (
              <>접기 <ChevronUp size={12} /></>
            ) : (
              <>나머지 {rest.length}개 금융사 더 보기 <ChevronDown size={12} /></>
            )}
          </button>
          {expanded && (
            <div className="divide-y divide-[#F0F2F8] bg-white border-t border-[#F0F2F8]">
              {rest.map((r, i) => (
                <FinanceRow key={`${r.financeCompanyName}-${i}`} result={r} rank={i + 2} best={best} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const RANK_STYLE: Record<number, { color: string; bg: string; label: string }> = {
  0: { color: "#000666", bg: "#E5E5FA", label: "최저가" },
  1: { color: "#059669", bg: "#ECFDF5", label: "2순위" },
  2: { color: "#D97706", bg: "#FFFBEB", label: "3순위" },
  3: { color: "#9BA4C0", bg: "#F4F5F8", label: "4순위" },
};

function FinanceRow({
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
    <div className={cn("flex items-center gap-3 px-4 py-3", isBest && "bg-primary-100")}>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] shrink-0 w-[46px] text-center"
        style={{ color: style.color, background: style.bg }}
      >
        {style.label}
      </span>
      <span className={cn("flex-1 text-[13px] truncate min-w-0", isBest ? "font-semibold text-primary" : "text-ink-body")}>
        {result.financeCompanyName}
      </span>
      <div className="flex flex-col items-end shrink-0">
        <span className={cn("text-[15px] font-semibold tabular-nums", isBest ? "text-primary" : "text-ink")}>
          {formatMonthly(result.monthlyPayment)}
        </span>
        <span className="text-[10px] text-ink-caption tabular-nums">
          {diff > 0 ? `+${formatCurrency(diff)}` : "기준가"}
        </span>
      </div>
    </div>
  );
}

// ─── 견적 산출 내역 섹션 ──────────────────────────────────
function BreakdownSection({
  data,
  open,
  onToggle,
}: {
  data: QuoteScenarioDetail;
  open: boolean;
  onToggle: () => void;
}) {
  const bd = data.breakdown;
  if (!bd) return null;

  return (
    <div className="rounded-[10px] border border-[#E8EAF2] overflow-hidden">
      {/* 요약 (항상 표시) */}
      <div className="px-4 py-3 bg-secondary-100 space-y-2.5">
        <p className="text-[11px] font-semibold text-ink-label uppercase tracking-wider">견적 산출 내역</p>
        <CalcRow label="차량가격" value={formatCurrency(bd.vehiclePrice)} />
        <CalcRow label="기준 대여료" value={formatCurrency(bd.baseMonthly)} bold />
        <div className="flex items-center justify-between pt-2 border-t border-[#D8DCF0] mt-0.5">
          <span className="text-[13px] font-semibold text-primary">최종 월 납입금</span>
          <span className="text-[20px] font-semibold text-primary tabular-nums">
            {formatMonthly(data.monthlyPayment)}
          </span>
        </div>
      </div>

      {/* 상세 토글 버튼 */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-neutral border-t border-[#ECEEF6] transition-colors text-[11px] font-medium text-ink-caption"
      >
        {open ? (
          <>상세 내역 접기 <ChevronUp size={12} /></>
        ) : (
          <>상세 내역 보기 <ChevronDown size={12} /></>
        )}
      </button>

      {/* 상세 (펼침, 회수율 제외) */}
      {open && (
        <div className="px-4 py-4 space-y-2 bg-white text-[13px] border-t border-[#F0F0F0]">
          {bd.depositDiscount > 0 && (
            <CalcRow
              label={`보증금 할인 (${((data.depositAmount / bd.vehiclePrice) * 100).toFixed(0)}%)`}
              value={`−${formatCurrency(bd.depositDiscount)}`}
              negative
            />
          )}
          {bd.prepayAdjust !== 0 && (
            <CalcRow
              label="선납금 공제·조정"
              value={bd.prepayAdjust < 0
                ? `−${formatCurrency(Math.abs(bd.prepayAdjust))}`
                : `+${formatCurrency(bd.prepayAdjust)}`}
              negative={bd.prepayAdjust < 0}
            />
          )}
          {(bd.depositDiscount > 0 || bd.prepayAdjust !== 0) && (
            <CalcRow label="조정 후 대여료" value={formatCurrency(bd.monthlyBeforeSurcharge)} bold />
          )}
          {data.surcharges && data.surcharges.totalSurcharge > 0 && (
            <CalcRow label="이자·수수료 가산" value={`+${formatCurrency(data.surcharges.totalSurcharge)}`} plus />
          )}
          {data.purchaseSurcharge > 0 && (
            <CalcRow
              label="인수 옵션 추가비 (+12%)"
              value={`+${formatCurrency(data.purchaseSurcharge)}`}
              plus
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── 공통 서브 컴포넌트 ────────────────────────────────────
function ConditionRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-caption">{label}</p>
      <p className="text-[13px] font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

function ApprovalPreview({ data }: { data: QuoteScenarioDetail }) {
  const depositRate = getDepositRate(data);
  const level = estimateApproval(data.monthlyPayment, depositRate);
  const copy = APPROVAL_COPY[level];

  return (
    <div className={cn("rounded-[10px] border px-4 py-3", copy.containerClass)}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={16} className={cn("mt-0.5 shrink-0", copy.iconClass)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-[12px] font-semibold text-ink-label">심사 가능성 미리보기</p>
            <span className={cn("rounded-[4px] px-2 py-0.5 text-[10px] font-bold", copy.badgeClass)}>
              {copy.label}
            </span>
          </div>
          <p className="text-[13px] font-medium text-ink">{copy.message}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-caption">
            실제 심사 결과는 금융사 기준, 신용도, 소득 증빙에 따라 달라질 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function CalcRow({
  label, value, bold, negative, plus,
}: {
  label: string; value: string;
  bold?: boolean; negative?: boolean; plus?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-ink-label", bold && "font-semibold text-ink")}>{label}</span>
      <span className={cn(
        "font-medium tabular-nums",
        bold ? "text-ink font-semibold" : "text-ink-body",
        negative && "text-success-text",
        plus && "text-ink-label",
      )}>
        {value}
      </span>
    </div>
  );
}

const CUSTOMER_TYPE_CHECKPOINTS: Partial<Record<CustomerType, string[]>> = {
  self_employed: [
    "개인사업자는 차량 이용 목적에 따라 비용처리와 부가세 처리 방식이 달라질 수 있습니다.",
    "최종 세무 판단은 사업자 등록 상태와 실제 사용 목적을 기준으로 세무사와 확인해 주세요.",
  ],
  corporate: [
    "법인은 업무용 차량 비용처리, 업무전용 자동차보험 가입 대상, 부가세 환급 가능 여부를 함께 확인해야 합니다.",
    "최종 세무 판단은 법인 회계 기준과 차량 운행 목적을 기준으로 세무사와 확인해 주세요.",
  ],
};

function CostCheckpoint({ contractType, customerType }: { contractType: string; customerType?: string }) {
  const points =
    contractType === "인수형"
      ? ["잔존가치로 차량 최종 매입", "감가상각 비용처리 가능 (법인)"]
      : ["계약 종료 후 반납, 교체 자유", "전액 비용처리 가능 (법인/개인사업자)"];
  const customerPoints = isCustomerType(customerType)
    ? CUSTOMER_TYPE_CHECKPOINTS[customerType] ?? []
    : [];

  return (
    <div className="rounded-[8px] bg-neutral p-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-ink-label">체크포인트</p>
      {points.map((p) => (
        <p key={p} className="text-[12px] text-ink-caption flex items-start gap-1.5">
          <span className="text-primary mt-0.5">•</span>
          {p}
        </p>
      ))}
      {customerPoints.length > 0 && (
        <div className="pt-2 mt-1 border-t border-[#E1E4EE] space-y-1.5">
          <p className="text-[11px] font-semibold text-ink-label">고객 유형 안내</p>
          {customerPoints.map((p) => (
            <p key={p} className="text-[12px] text-ink-caption flex items-start gap-1.5">
              <span className="text-primary mt-0.5">•</span>
              {p}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
