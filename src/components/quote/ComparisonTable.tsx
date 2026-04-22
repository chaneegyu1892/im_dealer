"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuoteResponse } from "@/types/api";
import type { QuoteScenarioDetail } from "@/types/quote";

type ScenarioKey = "conservative" | "standard" | "aggressive";

const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  conservative: "보수형",
  standard: "표준형",
  aggressive: "공격형",
};

interface ComparisonColumn {
  label: string;
  brand?: string;
  vehicleName: string;
  trimName: string;
  totalVehiclePrice: number;
  scenario: QuoteScenarioDetail;
  isPrimary?: boolean;
}

interface ComparisonTableProps {
  primary: {
    brand: string;
    name: string;
    result: QuoteResponse;
  };
  comparison: {
    brand: string;
    name: string;
    result: QuoteResponse;
  };
  scenario: ScenarioKey;
  onScenarioChange: (s: ScenarioKey) => void;
}

function formatWon(v: number): string {
  return `${v.toLocaleString()}원`;
}

function formatManWon(v: number): string {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

export function ComparisonTable({
  primary,
  comparison,
  scenario,
  onScenarioChange,
}: ComparisonTableProps) {
  const columns: ComparisonColumn[] = useMemo(() => {
    return [
      {
        label: "현재 견적",
        brand: primary.brand,
        vehicleName: primary.name,
        trimName: primary.result.trimName,
        totalVehiclePrice:
          primary.result.trimPrice +
          ((primary.result as QuoteResponse & { optionsTotalPrice?: number })
            .optionsTotalPrice ?? 0),
        scenario: primary.result.scenarios[scenario],
        isPrimary: true,
      },
      {
        label: "비교 차량",
        brand: comparison.brand,
        vehicleName: comparison.name,
        trimName: comparison.result.trimName,
        totalVehiclePrice:
          comparison.result.trimPrice +
          ((comparison.result as QuoteResponse & { optionsTotalPrice?: number })
            .optionsTotalPrice ?? 0),
        scenario: comparison.result.scenarios[scenario],
      },
    ];
  }, [primary, comparison, scenario]);

  const totalCosts = columns.map(
    (c) =>
      c.scenario.monthlyPayment * c.scenario.contractMonths +
      c.scenario.depositAmount +
      c.scenario.prepayAmount,
  );

  const monthlyValues = columns.map((c) => c.scenario.monthlyPayment);
  const cheapestMonthlyIdx = monthlyValues.indexOf(Math.min(...monthlyValues));
  const highestMonthlyIdx = monthlyValues.indexOf(Math.max(...monthlyValues));
  const cheapestTotalIdx = totalCosts.indexOf(Math.min(...totalCosts));
  const highestTotalIdx = totalCosts.indexOf(Math.max(...totalCosts));

  return (
    <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card overflow-hidden">
      {/* 시나리오 탭 */}
      <div className="border-b border-[#F0F0F0] px-4 md:px-5 py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[12px] text-ink-caption mr-2">시나리오</p>
          {(Object.keys(SCENARIO_LABELS) as ScenarioKey[]).map((key) => {
            const isActive = scenario === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onScenarioChange(key)}
                className={cn(
                  "px-3 py-1.5 rounded-pill text-[12px] font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "bg-neutral text-ink-label hover:text-ink",
                )}
              >
                {SCENARIO_LABELS[key]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 데스크톱: 가로 테이블 / 모바일: 세로 스택 */}
      <div className="hidden md:block">
        <DesktopTable
          columns={columns}
          totalCosts={totalCosts}
          cheapestMonthlyIdx={cheapestMonthlyIdx}
          highestMonthlyIdx={highestMonthlyIdx}
          cheapestTotalIdx={cheapestTotalIdx}
          highestTotalIdx={highestTotalIdx}
        />
      </div>
      <div className="md:hidden">
        <MobileStack
          columns={columns}
          totalCosts={totalCosts}
          cheapestMonthlyIdx={cheapestMonthlyIdx}
          highestMonthlyIdx={highestMonthlyIdx}
          cheapestTotalIdx={cheapestTotalIdx}
          highestTotalIdx={highestTotalIdx}
        />
      </div>
    </div>
  );
}

interface RowProps {
  columns: ComparisonColumn[];
  totalCosts: number[];
  cheapestMonthlyIdx: number;
  highestMonthlyIdx: number;
  cheapestTotalIdx: number;
  highestTotalIdx: number;
}

function DesktopTable({
  columns,
  totalCosts,
  cheapestMonthlyIdx,
  highestMonthlyIdx,
  cheapestTotalIdx,
  highestTotalIdx,
}: RowProps) {
  return (
    <div className="grid grid-cols-[minmax(130px,max-content)_1fr_1fr] divide-x divide-[#F0F0F0]">
      {/* Header row */}
      <div className="bg-neutral" />
      {columns.map((col, i) => (
        <div
          key={i}
          className={cn(
            "p-4",
            col.isPrimary ? "bg-primary-100" : "bg-white",
          )}
        >
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
            {col.label}
          </p>
          <p className="text-[12px] text-ink-caption">{col.brand}</p>
          <p className="text-[15px] font-medium text-ink leading-snug">{col.vehicleName}</p>
          <p className="text-[12px] text-ink-label mt-0.5">{col.trimName}</p>
        </div>
      ))}

      {/* Vehicle price */}
      <LabelCell>차량가 (옵션 포함)</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[14px] text-ink">
            {formatManWon(col.totalVehiclePrice)}
          </span>
        </ValueCell>
      ))}

      {/* Monthly payment — highlight */}
      <LabelCell highlight>월 납입금</LabelCell>
      {columns.map((col, i) => {
        const isCheapest = i === cheapestMonthlyIdx && cheapestMonthlyIdx !== highestMonthlyIdx;
        const isHighest = i === highestMonthlyIdx && cheapestMonthlyIdx !== highestMonthlyIdx;
        return (
          <ValueCell key={i} highlight>
            <div className="flex items-center gap-1.5">
              <span className="text-[20px] font-semibold text-ink">
                {formatWon(col.scenario.monthlyPayment)}
              </span>
              {isCheapest && <CheapestBadge />}
              {isHighest && <HighestBadge />}
            </div>
          </ValueCell>
        );
      })}

      {/* Deposit */}
      <LabelCell>보증금</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[14px] text-ink-body">
            {col.scenario.depositAmount > 0
              ? formatWon(col.scenario.depositAmount)
              : "—"}
          </span>
        </ValueCell>
      ))}

      {/* Prepay */}
      <LabelCell>선납금</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[14px] text-ink-body">
            {col.scenario.prepayAmount > 0
              ? formatWon(col.scenario.prepayAmount)
              : "—"}
          </span>
        </ValueCell>
      ))}

      {/* Best finance company */}
      <LabelCell>최저가 금융사</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[13px] text-ink font-medium">
            {col.scenario.bestFinanceCompany}
          </span>
        </ValueCell>
      ))}

      {/* Total cost estimate */}
      <LabelCell highlight>예상 총 비용</LabelCell>
      {columns.map((_, i) => {
        const isCheapest = i === cheapestTotalIdx && cheapestTotalIdx !== highestTotalIdx;
        const isHighest = i === highestTotalIdx && cheapestTotalIdx !== highestTotalIdx;
        return (
          <ValueCell key={i} highlight>
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-semibold text-ink">
                {formatManWon(totalCosts[i])}
              </span>
              {isCheapest && <CheapestBadge />}
              {isHighest && <HighestBadge />}
            </div>
            <p className="text-[11px] text-ink-caption mt-0.5">
              월 × {columns[i].scenario.contractMonths}개월 + 보증금 + 선납금
            </p>
          </ValueCell>
        );
      })}
    </div>
  );
}

function MobileStack({
  columns,
  totalCosts,
  cheapestMonthlyIdx,
  highestMonthlyIdx,
  cheapestTotalIdx,
  highestTotalIdx,
}: RowProps) {
  return (
    <div className="divide-y divide-[#F0F0F0]">
      {columns.map((col, i) => {
        const isCheapestM = i === cheapestMonthlyIdx && cheapestMonthlyIdx !== highestMonthlyIdx;
        const isHighestM = i === highestMonthlyIdx && cheapestMonthlyIdx !== highestMonthlyIdx;
        const isCheapestT = i === cheapestTotalIdx && cheapestTotalIdx !== highestTotalIdx;
        const isHighestT = i === highestTotalIdx && cheapestTotalIdx !== highestTotalIdx;
        return (
          <div
            key={i}
            className={cn("p-4", col.isPrimary ? "bg-primary-100" : "bg-white")}
          >
            <div className="flex items-start gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-0.5">
                  {col.label}
                </p>
                <p className="text-[11px] text-ink-caption">{col.brand}</p>
                <p className="text-[15px] font-medium text-ink leading-snug truncate">
                  {col.vehicleName}
                </p>
                <p className="text-[12px] text-ink-label mt-0.5 truncate">
                  {col.trimName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] text-ink-caption">차량가</p>
                <p className="text-[13px] font-medium text-ink">
                  {formatManWon(col.totalVehiclePrice)}
                </p>
              </div>
            </div>

            {/* 월 납입금 */}
            <div className="bg-white rounded-[8px] border border-[#F0F0F0] p-3 mb-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-ink-label">월 납입금</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[20px] font-semibold text-ink">
                    {formatWon(col.scenario.monthlyPayment)}
                  </span>
                  {isCheapestM && <CheapestBadge />}
                  {isHighestM && <HighestBadge />}
                </div>
              </div>
            </div>

            {/* 세부 */}
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <dt className="text-ink-caption">보증금</dt>
              <dd className="text-right text-ink-body">
                {col.scenario.depositAmount > 0 ? formatWon(col.scenario.depositAmount) : "—"}
              </dd>
              <dt className="text-ink-caption">선납금</dt>
              <dd className="text-right text-ink-body">
                {col.scenario.prepayAmount > 0 ? formatWon(col.scenario.prepayAmount) : "—"}
              </dd>
              <dt className="text-ink-caption">최저가 금융사</dt>
              <dd className="text-right text-ink font-medium">
                {col.scenario.bestFinanceCompany}
              </dd>
            </dl>

            {/* 총 비용 */}
            <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex items-center justify-between">
              <div>
                <p className="text-[12px] text-ink-label">예상 총 비용</p>
                <p className="text-[10px] text-ink-caption">
                  월 × {col.scenario.contractMonths}개월 + 보증금 + 선납금
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-semibold text-ink">
                  {formatManWon(totalCosts[i])}
                </span>
                {isCheapestT && <CheapestBadge />}
                {isHighestT && <HighestBadge />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LabelCell({
  children,
  highlight = false,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 py-3 text-[12px] font-medium text-ink-label bg-neutral flex items-center",
        highlight && "font-semibold text-ink",
      )}
    >
      {children}
    </div>
  );
}

function ValueCell({
  children,
  highlight = false,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={cn("px-4 py-3", highlight && "bg-primary-100/30")}>
      {children}
    </div>
  );
}

function CheapestBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 bg-success-bg text-success-text text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px]"
      aria-label="가장 저렴"
    >
      <ArrowDown size={10} strokeWidth={2.5} />
      최저
    </span>
  );
}

function HighestBadge() {
  return (
    <span
      className="inline-flex items-center gap-0.5 bg-error-bg text-error-text text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px]"
      aria-label="가장 비쌈"
    >
      <ArrowUp size={10} strokeWidth={2.5} />
      최고
    </span>
  );
}
