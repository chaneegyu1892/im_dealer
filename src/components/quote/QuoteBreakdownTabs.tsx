"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatMonthly } from "@/lib/utils";
import { Building2, ChevronDown, ChevronUp, ShieldCheck, Trophy } from "lucide-react";
import { isCustomerType, type CustomerType } from "@/constants/customer-types";
import type { QuoteScenarioDetails, QuoteScenarioDetail, FinanceCompanyQuote } from "@/types/quote";
import { QuoteMonthlyDonut } from "./QuoteMonthlyDonut";

type ScenarioKey = keyof QuoteScenarioDetails;
type ApprovalPreviewLevel = "high" | "medium" | "low";

const TABS: { key: ScenarioKey; label: string; desc: string }[] = [
  { key: "conservative", label: "보수형", desc: "보증금 있음 · 월납입 ↓" },
  { key: "standard",     label: "표준형", desc: "균형 조건 · 추천" },
  { key: "aggressive",   label: "공격형", desc: "선납금 있음 · 월납입 최소" },
];

const APPROVAL_PREVIEW_COPY: Record<ApprovalPreviewLevel, {
  label: string;
  message: string;
  badgeClassName: string;
  containerClassName: string;
  iconClassName: string;
}> = {
  high: {
    label: "유리",
    message: "이 조건은 심사에 유리한 편입니다",
    badgeClassName: "bg-[#ECFDF5] text-[#047857]",
    containerClassName: "bg-[#F0FDF4] border-[#BBF7D0]",
    iconClassName: "text-[#059669]",
  },
  medium: {
    label: "보완 권장",
    message: "보증금을 추가하면 심사 가능성이 높아질 수 있습니다",
    badgeClassName: "bg-[#FFFBEB] text-[#B45309]",
    containerClassName: "bg-[#FFFBEB] border-[#FDE68A]",
    iconClassName: "text-[#D97706]",
  },
  low: {
    label: "증빙 필요",
    message: "소득 증빙 또는 보증금 확대를 권장합니다",
    badgeClassName: "bg-[#FFF7ED] text-[#C2410C]",
    containerClassName: "bg-[#FFF7ED] border-[#FED7AA]",
    iconClassName: "text-[#EA580C]",
  },
};

function getDepositRate(data: QuoteScenarioDetail) {
  const vehiclePrice = data.breakdown?.vehiclePrice ?? 0;
  if (vehiclePrice <= 0 || data.depositAmount <= 0) return 0;
  return Math.round((data.depositAmount / vehiclePrice) * 100);
}

function estimateApprovalPreview(monthlyPayment: number, depositRate: number): ApprovalPreviewLevel {
  if (depositRate >= 20) return "high";
  if (monthlyPayment < 400_000) return "high";
  if (monthlyPayment < 700_000) return "medium";
  return "low";
}

interface Props {
  scenarios: QuoteScenarioDetails;
  defaultTab?: ScenarioKey;
  onTabChange?: (tab: ScenarioKey) => void;
  customRates?: { depositRate: number; prepayRate: number };
  onCustomRatesChange?: (rates: { depositRate: number; prepayRate: number }) => void;
  isRecalculating?: boolean;
  customerType?: string;
}

export function QuoteBreakdownTabs({
  scenarios,
  defaultTab = "standard",
  onTabChange,
  customRates,
  onCustomRatesChange,
  isRecalculating = false,
  customerType,
}: Props) {
  const [active, setActive] = useState<ScenarioKey>(defaultTab);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const data = scenarios[active];

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex border-b border-neutral-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActive(tab.key);
              onTabChange?.(tab.key);
              setBreakdownOpen(false);
            }}
            className={cn(
              "flex-1 py-3 text-[13px] font-medium transition-colors duration-150 relative",
              active === tab.key
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                : "text-ink-caption hover:text-ink"
            )}
          >
            <span className="block">{tab.label}</span>
            {tab.key === "standard" && (
              <span className="text-[10px] font-normal text-secondary">기본 추천</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="pt-5 space-y-5">
        {/* ① 월 납입금 + 금융사 배지 */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] text-ink-caption mb-1">월 납입금</p>
            <p className="text-[26px] md:text-[32px] font-light text-ink leading-none">
              {formatMonthly(data.monthlyPayment)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                "text-[11px] font-semibold rounded-pill px-2.5 py-1",
                active === "standard"
                  ? "bg-primary text-white"
                  : "bg-neutral-800 text-ink-label"
              )}
            >
              {TABS.find((t) => t.key === active)?.label}
            </span>
            {data.bestFinanceCompany && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-label bg-secondary-100 border border-secondary-200 rounded-pill px-2.5 py-1">
                <Building2 size={10} className="text-secondary" />
                {data.bestFinanceCompany}
              </span>
            )}
          </div>
        </div>

        {/* 표준형 탭 전용 슬라이더 */}
        {active === "standard" && onCustomRatesChange && customRates && (
          <CustomRateSliders
            depositRate={customRates.depositRate}
            prepayRate={customRates.prepayRate}
            isRecalculating={isRecalculating}
            onChange={onCustomRatesChange}
          />
        )}

        {/* 도넛 — 월 납입금 구성 시각화 */}
        <div className={cn("transition-opacity duration-200", isRecalculating && active === "standard" && "opacity-60")}>
          <QuoteMonthlyDonut scenario={data} />
        </div>

        {/* ② 계약 조건 그리드 */}
        <div className="rounded-[10px] bg-neutral p-4 grid grid-cols-2 gap-y-3 gap-x-4">
          <ConditionRow label="계약기간" value={`${data.contractMonths}개월`} />
          <ConditionRow
            label="약정거리"
            value={`연 ${(data.annualMileage / 10000).toFixed(0)}만km`}
          />
          <ConditionRow
            label="보증금"
            value={data.depositAmount > 0 ? formatCurrency(data.depositAmount) : "없음"}
          />
          <ConditionRow
            label="선납금"
            value={data.prepayAmount > 0 ? formatCurrency(data.prepayAmount) : "없음"}
          />
          <ConditionRow label="계약 종류" value={data.contractType} />
        </div>

        {/* ③ 심사 가능성 미리보기 */}
        <ApprovalPreview data={data} />

        {/* ④ 견적 산출 내역 (펼침/접힘) */}
        {data.breakdown && data.surcharges && (
          <div className={cn("rounded-[10px] border border-[#E8EAF2] overflow-hidden transition-opacity duration-200", isRecalculating && active === "standard" && "opacity-60")}>
            <button
              type="button"
              onClick={() => setBreakdownOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-secondary-100 hover:bg-secondary-200 transition-colors duration-150"
            >
              <span className="text-[12px] font-semibold text-ink-label tracking-wide uppercase">
                견적 산출 내역
              </span>
              {breakdownOpen ? (
                <ChevronUp size={14} className="text-ink-caption" />
              ) : (
                <ChevronDown size={14} className="text-ink-caption" />
              )}
            </button>

            {breakdownOpen && (
              <BreakdownDetail data={data} />
            )}
          </div>
        )}

        {/* ⑤ 금융사별 비교 (펼침/접힘) */}
        {data.allFinanceResults.length > 1 && (
          <div className="rounded-[10px] border border-[#E8EAF2] overflow-hidden">
            <button
              type="button"
              onClick={() => setCompareOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-neutral hover:bg-neutral-800 transition-colors duration-150"
            >
              <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-label tracking-wide uppercase">
                <Trophy size={12} className="text-primary" />
                금융사별 견적 비교
              </span>
              {compareOpen ? (
                <ChevronUp size={14} className="text-ink-caption" />
              ) : (
                <ChevronDown size={14} className="text-ink-caption" />
              )}
            </button>

            {compareOpen && (
              <FinanceCompareTable results={data.allFinanceResults} />
            )}
          </div>
        )}

        {/* ⑥ 체크포인트 */}
        <CostCheckpoint contractType={data.contractType} customerType={customerType} />
      </div>
    </div>
  );
}

// ─── 산출 내역 상세 ───────────────────────────────────────

function BreakdownDetail({ data }: { data: QuoteScenarioDetail }) {
  const { breakdown: bd } = data;
  if (!bd) return null;

  const recoveryPct = (bd.recoveryRate * 100).toFixed(4);

  return (
    <div className="px-4 py-4 space-y-4 bg-white text-[13px]">
      {/* 기준 대여료 계산 */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-ink-caption uppercase tracking-wider">
          기준 대여료 산출
        </p>
        <CalcRow label="차량가격" value={formatCurrency(bd.vehiclePrice)} />
        <CalcRow label={`회수율`} value={`${recoveryPct}%`} accent />
        <CalcRow label="기준 대여료" value={formatCurrency(bd.baseMonthly)} bold />

        {bd.depositDiscount > 0 && (
          <CalcRow
            label={`보증금 할인 (${((data.depositAmount / bd.vehiclePrice) * 100).toFixed(0)}%)`}
            value={`-${formatCurrency(bd.depositDiscount)}`}
            negative
          />
        )}
        {bd.prepayAdjust !== 0 && (
          <CalcRow
            label={`선납금 공제·조정`}
            value={bd.prepayAdjust < 0
              ? `-${formatCurrency(Math.abs(bd.prepayAdjust))}`
              : `+${formatCurrency(bd.prepayAdjust)}`}
            negative={bd.prepayAdjust < 0}
          />
        )}

        {(bd.depositDiscount > 0 || bd.prepayAdjust !== 0) && (
          <>
            <div className="border-t border-dashed border-neutral-800 pt-2">
              <CalcRow
                label="조정 후 대여료"
                value={formatCurrency(bd.monthlyBeforeSurcharge)}
                bold
              />
            </div>
          </>
        )}
      </div>

      {/* 인수 옵션 추가비 */}
      {data.purchaseSurcharge > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-ink-caption uppercase tracking-wider">
            인수 옵션 추가비
          </p>
          <CalcRow
            label="인수 옵션 추가비 (+12%)"
            value={`+${formatCurrency(data.purchaseSurcharge)}`}
            plus
          />
          <p className="text-[11px] text-ink-caption leading-relaxed">
            계약 종료 후 잔존가치로 차량을 인수하기 위한 추가 비용입니다.
          </p>
        </div>
      )}

      {/* 최종 결과 */}
      <div className="rounded-[8px] bg-primary-100 border border-primary-200 px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-primary">최종 월 납입금</span>
        <span className="text-[20px] font-semibold text-primary">
          {formatMonthly(data.monthlyPayment)}
        </span>
      </div>
    </div>
  );
}

// ─── 공통 서브 컴포넌트 ───────────────────────────────────

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
  const level = estimateApprovalPreview(data.monthlyPayment, depositRate);
  const copy = APPROVAL_PREVIEW_COPY[level];

  return (
    <div className={cn("rounded-[10px] border px-4 py-3", copy.containerClassName)}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={16} className={cn("mt-0.5 shrink-0", copy.iconClassName)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12px] font-semibold text-ink-label">
              심사 가능성 미리보기
            </p>
            <span className={cn("rounded-[4px] px-2 py-0.5 text-[10px] font-bold", copy.badgeClassName)}>
              {copy.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] font-medium text-ink">
            {copy.message}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-caption">
            실제 심사 결과는 금융사 기준, 신용도, 소득 증빙에 따라 달라질 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function CalcRow({
  label,
  value,
  bold,
  negative,
  plus,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  plus?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-ink-label", bold && "font-semibold text-ink")}>
        {label}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
          bold ? "text-ink font-semibold" : "text-ink-body",
          negative && "text-success-text",
          plus && "text-ink-label",
          accent && "text-primary font-semibold"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── 금융사 비교 테이블 ───────────────────────────────────

const RANK_LABEL: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "최저가", color: "#000666", bg: "#E5E5FA" },
  2: { label: "2순위",  color: "#059669", bg: "#ECFDF5" },
  3: { label: "3순위",  color: "#D97706", bg: "#FFFBEB" },
  4: { label: "4순위",  color: "#9BA4C0", bg: "#F4F5F8" },
};

function FinanceCompareTable({ results }: { results: FinanceCompanyQuote[] }) {
  const sortedResults = [...results].sort((a, b) => a.monthlyPayment - b.monthlyPayment);
  const best = sortedResults[0]?.monthlyPayment ?? 0;
  const maxPayment = Math.max(...sortedResults.map((r) => r.monthlyPayment), best);
  const paymentRange = maxPayment - best;

  return (
    <div className="divide-y divide-[#F0F2F8] bg-white">
      {sortedResults.map((r, index) => {
        const diff = r.monthlyPayment - best;
        const isBest = index === 0;
        const displayRank = index + 1;
        const rankInfo = RANK_LABEL[displayRank] ?? RANK_LABEL[4];
        const barWidth = paymentRange > 0
          ? 100 - ((r.monthlyPayment - best) / paymentRange) * 15
          : 100;

        return (
          <div
            key={`${r.financeCompanyName}-${r.rank}`}
            className={cn(
              "px-4 py-3 space-y-2",
              isBest && "bg-primary-100"
            )}
          >
            <div className="flex items-center gap-3">
              {/* 순위 배지 */}
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] shrink-0 w-[46px] text-center"
                style={{ color: rankInfo.color, background: rankInfo.bg }}
              >
                {rankInfo.label}
              </span>

              {/* 금융사명 */}
              <span className={cn(
                "min-w-0 flex-1 text-[13px] truncate",
                isBest ? "font-semibold text-primary" : "text-ink-body"
              )}>
                {r.financeCompanyName}
              </span>

              {/* 금액 요약 */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={cn(
                  "text-[15px] font-semibold tabular-nums",
                  isBest ? "text-primary" : "text-ink"
                )}>
                  {formatMonthly(r.monthlyPayment)}
                </span>
                <span className="text-[10px] text-ink-caption tabular-nums">
                  {diff > 0 ? `+${formatCurrency(diff)}` : "기준가"}
                </span>
              </div>
            </div>

            <svg
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              className="block h-2.5 w-full"
              role="img"
              aria-label={`${r.financeCompanyName} 월 납입금 ${formatMonthly(r.monthlyPayment)}`}
            >
              <rect
                x="0"
                y="0"
                width="100"
                height="10"
                fill={isBest ? "#E5E5FA" : "#E8EAF2"}
              />
              <rect
                x="0"
                y="0"
                width={barWidth}
                height="10"
                fill={isBest ? "#000666" : "#6066EE"}
                opacity={isBest ? 1 : 0.92}
              />
            </svg>
          </div>
        );
      })}

    </div>
  );
}

// ─── 보증금/선납금 슬라이더 (표준형 탭 전용) ─────────────

interface CustomRateSlidersProps {
  depositRate: number;
  prepayRate: number;
  isRecalculating: boolean;
  onChange: (rates: { depositRate: number; prepayRate: number }) => void;
}

const SLIDER_STEPS = [0, 5, 10, 15, 20, 25, 30];

function StyledSlider({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const pct = (value / 30) * 100;

  return (
    <div className="relative h-6 flex items-center">
      {/* 트랙 베이스 */}
      <div className="absolute inset-x-0 h-[5px] rounded-full bg-neutral-700 overflow-hidden">
        {/* 채워지는 fill — transition으로 부드럽게 */}
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: disabled
              ? "#C0C4D0"
              : "linear-gradient(90deg, #000666 0%, #6066EE 100%)",
          }}
        />
      </div>

      {/* 눈금 점 */}
      {SLIDER_STEPS.map((step) => {
        const stepPct = (step / 30) * 100;
        const isActive = value >= step;
        return (
          <div
            key={step}
            className="absolute w-[3px] h-[3px] rounded-full -translate-x-1/2 transition-colors duration-300"
            style={{
              left: `${stepPct}%`,
              background: isActive && !disabled ? "#fff" : "#C0C4D0",
              opacity: step === 0 || step === 30 ? 0 : 1,
            }}
          />
        );
      })}

      {/* 썸 */}
      <div
        className="absolute w-[18px] h-[18px] rounded-full shadow-md -translate-x-1/2 transition-all duration-300 ease-out pointer-events-none"
        style={{
          left: `${pct}%`,
          background: disabled ? "#C0C4D0" : "#fff",
          border: `2.5px solid ${disabled ? "#C0C4D0" : "#000666"}`,
          boxShadow: disabled ? "none" : "0 1px 6px rgba(0,6,102,0.25)",
          transform: `translateX(-50%) scale(${value > 0 && !disabled ? 1.15 : 1})`,
        }}
      />

      {/* 실제 input (투명, 접근성·드래그 담당) */}
      <input
        type="range"
        min={0}
        max={30}
        step={5}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 opacity-0 w-full cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

function CustomRateSliders({ depositRate, prepayRate, isRecalculating, onChange }: CustomRateSlidersProps) {
  function handleDepositChange(v: number) {
    onChange({ depositRate: v, prepayRate: v > 0 ? 0 : prepayRate });
  }
  function handlePrepayChange(v: number) {
    onChange({ depositRate: v > 0 ? 0 : depositRate, prepayRate: v });
  }

  return (
    <div className="rounded-[10px] bg-neutral px-4 py-3 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-label uppercase tracking-wider">
          조건 직접 설정
        </p>
        <span
          className={cn(
            "flex items-center gap-1 text-[11px] text-ink-caption transition-opacity duration-200",
            isRecalculating ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          재계산 중…
        </span>
      </div>

      {/* 보증금률 슬라이더 */}
      <div
        className={cn(
          "space-y-2 transition-all duration-300",
          prepayRate > 0 ? "opacity-40 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-caption">보증금</span>
          <span
            className={cn(
              "text-[13px] font-semibold tabular-nums transition-all duration-200",
              depositRate > 0 ? "text-primary" : "text-ink-caption"
            )}
          >
            {depositRate > 0 ? `${depositRate}%` : "없음"}
          </span>
        </div>
        <StyledSlider
          value={depositRate}
          disabled={prepayRate > 0}
          onChange={handleDepositChange}
        />
        {/* 눈금 레이블 */}
        <div className="flex justify-between px-0.5">
          {SLIDER_STEPS.filter((s) => s % 10 === 0).map((s) => (
            <span key={s} className="text-[10px] text-ink-caption tabular-nums">
              {s === 0 ? "없음" : `${s}%`}
            </span>
          ))}
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-[#EBEBEB]" />

      {/* 선납금률 슬라이더 */}
      <div
        className={cn(
          "space-y-2 transition-all duration-300",
          depositRate > 0 ? "opacity-40 pointer-events-none" : "opacity-100"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-caption">선납금</span>
          <span
            className={cn(
              "text-[13px] font-semibold tabular-nums transition-all duration-200",
              prepayRate > 0 ? "text-primary" : "text-ink-caption"
            )}
          >
            {prepayRate > 0 ? `${prepayRate}%` : "없음"}
          </span>
        </div>
        <StyledSlider
          value={prepayRate}
          disabled={depositRate > 0}
          onChange={handlePrepayChange}
        />
        <div className="flex justify-between px-0.5">
          {SLIDER_STEPS.filter((s) => s % 10 === 0).map((s) => (
            <span key={s} className="text-[10px] text-ink-caption tabular-nums">
              {s === 0 ? "없음" : `${s}%`}
            </span>
          ))}
        </div>
      </div>

      {(depositRate > 0 || prepayRate > 0) && (
        <p className="text-[11px] text-ink-caption -mt-1">
          보증금과 선납금은 동시에 적용할 수 없습니다.
        </p>
      )}
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
  nonprofit: [
    "비영리법인은 보조금 사용 가능 여부, 부가세 환급 대상 여부, 보험 조건을 기관 기준에 맞춰 확인해야 합니다.",
    "최종 세무 판단은 기관 회계 기준과 관련 증빙을 기준으로 세무사와 확인해 주세요.",
  ],
};

function CostCheckpoint({
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
    <div className="rounded-[8px] bg-neutral p-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-ink-label">체크포인트</p>
      {points.map((p) => (
        <p key={p} className="text-[12px] text-ink-caption flex items-start gap-1.5">
          <span className="text-primary mt-0.5">•</span>
          {p}
        </p>
      ))}
      {customerPoints.length > 0 && (
        <div className="pt-2 mt-2 border-t border-[#E1E4EE] space-y-1.5">
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
