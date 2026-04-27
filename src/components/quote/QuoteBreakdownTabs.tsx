"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatMonthly } from "@/lib/utils";
import { Building2, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import type { QuoteScenarioDetails, QuoteScenarioDetail, FinanceCompanyQuote } from "@/types/quote";
import { QuoteMonthlyDonut } from "./QuoteMonthlyDonut";

type ScenarioKey = keyof QuoteScenarioDetails;

const TABS: { key: ScenarioKey; label: string; desc: string }[] = [
  { key: "conservative", label: "보수형", desc: "보증금 있음 · 월납입 ↓" },
  { key: "standard",     label: "표준형", desc: "균형 조건 · 추천" },
  { key: "aggressive",   label: "공격형", desc: "선납금 있음 · 월납입 최소" },
];

interface Props {
  scenarios: QuoteScenarioDetails;
  defaultTab?: ScenarioKey;
  onTabChange?: (tab: ScenarioKey) => void;
  customRates?: { depositRate: number; prepayRate: number };
  onCustomRatesChange?: (rates: { depositRate: number; prepayRate: number }) => void;
  isRecalculating?: boolean;
}

export function QuoteBreakdownTabs({
  scenarios,
  defaultTab = "standard",
  onTabChange,
  customRates,
  onCustomRatesChange,
  isRecalculating = false,
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

        {/* ③ 견적 산출 내역 (펼침/접힘) */}
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

        {/* ④ 금융사별 비교 (펼침/접힘) */}
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

        {/* ⑤ 체크포인트 */}
        <CostCheckpoint contractType={data.contractType} />
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
  const best = results[0]?.monthlyPayment ?? 0;

  return (
    <div className="divide-y divide-[#F0F2F8] bg-white">
      {results.map((r) => {
        const diff = r.monthlyPayment - best;
        const rankInfo = RANK_LABEL[r.rank] ?? RANK_LABEL[4];

        return (
          <div
            key={r.rank}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              r.rank === 1 && "bg-primary-100"
            )}
          >
            {/* 순위 배지 */}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] shrink-0 w-[46px] text-center"
              style={{ color: rankInfo.color, background: rankInfo.bg }}
            >
              {rankInfo.label}
            </span>

            {/* 금융사명 */}
            <span className={cn(
              "flex-1 text-[13px]",
              r.rank === 1 ? "font-semibold text-primary" : "text-ink-body"
            )}>
              {r.financeCompanyName}
            </span>

            {/* 금액 요약 */}
            <div className="flex flex-col items-end gap-0.5">
              <span className={cn(
                "text-[15px] font-semibold tabular-nums",
                r.rank === 1 ? "text-primary" : "text-ink"
              )}>
                {formatMonthly(r.monthlyPayment)}
              </span>
              {diff > 0 && (
                <span className="text-[10px] text-ink-caption tabular-nums">
                  +{formatCurrency(diff)}
                </span>
              )}
            </div>
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

function CustomRateSliders({ depositRate, prepayRate, isRecalculating, onChange }: CustomRateSlidersProps) {
  function handleDepositChange(v: number) {
    onChange({ depositRate: v, prepayRate: v > 0 ? 0 : prepayRate });
  }
  function handlePrepayChange(v: number) {
    onChange({ depositRate: v > 0 ? 0 : depositRate, prepayRate: v });
  }

  return (
    <div className="rounded-[10px] bg-neutral px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-label uppercase tracking-wider">
          조건 직접 설정
        </p>
        {isRecalculating && (
          <span className="flex items-center gap-1 text-[11px] text-ink-caption">
            <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            재계산 중…
          </span>
        )}
      </div>

      {/* 보증금률 슬라이더 */}
      <div className={cn("space-y-1.5", prepayRate > 0 && "opacity-50")}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-caption">보증금</span>
          <span className="text-[12px] font-semibold text-ink tabular-nums">
            {depositRate > 0 ? `${depositRate}%` : "없음"}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={30}
          step={5}
          value={depositRate}
          disabled={prepayRate > 0}
          onChange={(e) => handleDepositChange(Number(e.target.value))}
          className="w-full accent-primary h-1.5 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      {/* 선납금률 슬라이더 */}
      <div className={cn("space-y-1.5", depositRate > 0 && "opacity-50")}>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-ink-caption">선납금</span>
          <span className="text-[12px] font-semibold text-ink tabular-nums">
            {prepayRate > 0 ? `${prepayRate}%` : "없음"}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={30}
          step={5}
          value={prepayRate}
          disabled={depositRate > 0}
          onChange={(e) => handlePrepayChange(Number(e.target.value))}
          className="w-full accent-primary h-1.5 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>

      {(depositRate > 0 || prepayRate > 0) && (
        <p className="text-[11px] text-ink-caption">
          보증금과 선납금은 동시에 적용할 수 없습니다.
        </p>
      )}
    </div>
  );
}

function CostCheckpoint({ contractType }: { contractType: string }) {
  const points =
    contractType === "인수형"
      ? ["잔존가치로 차량 최종 매입", "감가상각 비용처리 가능 (법인)"]
      : ["계약 종료 후 반납, 교체 자유", "전액 비용처리 가능 (법인/개인사업자)"];

  return (
    <div className="rounded-[8px] bg-neutral p-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-ink-label">체크포인트</p>
      {points.map((p) => (
        <p key={p} className="text-[12px] text-ink-caption flex items-start gap-1.5">
          <span className="text-primary mt-0.5">•</span>
          {p}
        </p>
      ))}
    </div>
  );
}
