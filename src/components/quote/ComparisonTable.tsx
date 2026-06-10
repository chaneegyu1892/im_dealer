"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { QuoteResponse } from "@/types/api";
import type { QuoteScenarioDetail } from "@/types/quote";

/** 견적 구성(라인업/옵션/색상) — "같은 기준의 비교인지" 드러내기 위한 정보 */
export interface ComparisonColumnConfig {
  lineupName: string | null;
  optionNames: string[];
  exteriorColor: { name: string; priceDelta: number } | null;
  interiorColor: { name: string; priceDelta: number } | null;
}

interface ComparisonColumn {
  label: string;
  brand?: string;
  vehicleName: string;
  trimName: string;
  /** 기본 차량가 (할인 적용가) */
  basePrice: number;
  /** 할인 전 정가 — 할인이 있을 때만 존재 */
  originalPrice: number | null;
  /** 총 차량가 = 기본 + 옵션 + 색상 */
  totalVehiclePrice: number;
  scenario: QuoteScenarioDetail;
  config?: ComparisonColumnConfig;
  isPrimary?: boolean;
}

interface ComparisonTableProps {
  primary: { brand: string; name: string; result: QuoteResponse; config?: ComparisonColumnConfig };
  comparison: { brand: string; name: string; result: QuoteResponse; config?: ComparisonColumnConfig };
}

function formatWon(v: number): string {
  return `${v.toLocaleString()}원`;
}
function formatManWon(v: number): string {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

/** 차이 뱃지: 기준(primary) 대비 해당 열의 차이를 표시 */
function DeltaBadge({
  value,
  baseValue,
  unit = "won",
}: {
  value: number;
  baseValue: number;
  unit?: "won" | "man";
}) {
  const diff = value - baseValue;
  if (diff === 0) return null;

  const fmt = unit === "man"
    ? `${Math.abs(Math.round(diff / 10000)).toLocaleString()}만원`
    : `${Math.abs(diff).toLocaleString()}원`;

  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ml-1",
        diff < 0
          ? "bg-emerald-50 text-emerald-600"   // 더 저렴
          : "bg-red-50 text-red-500"            // 더 비쌈
      )}
    >
      {diff < 0 ? `▼ ${fmt} 저렴` : `▲ ${fmt} 비쌈`}
    </span>
  );
}

export function ComparisonTable({ primary, comparison }: ComparisonTableProps) {
  // 훅은 항상 먼저 호출 (early return 이전)
  const primaryScenario = primary.result.scenarios?.standard;
  const compScenario = comparison.result.scenarios?.standard;

  const columns: ComparisonColumn[] = useMemo(() => {
    if (!primaryScenario || !compScenario) return [];
    // 총 차량가는 월 납입금 계산과 같은 기준(할인가 + 옵션 + 색상)으로 표기한다
    const toColumn = (
      label: string,
      src: { brand: string; name: string; result: QuoteResponse; config?: ComparisonColumnConfig },
      scenario: QuoteScenarioDetail,
      isPrimary: boolean
    ): ComparisonColumn => {
      const basePrice = src.result.discountPrice ?? src.result.trimPrice;
      return {
        label,
        brand: src.brand,
        vehicleName: src.name,
        trimName: src.result.trimName,
        basePrice,
        originalPrice:
          src.result.discountPrice != null && src.result.discountPrice < src.result.trimPrice
            ? src.result.trimPrice
            : null,
        totalVehiclePrice:
          src.result.totalVehiclePrice ??
          basePrice + (src.result.optionsTotalPrice ?? 0) + (src.result.colorDelta ?? 0),
        scenario,
        config: src.config,
        isPrimary,
      };
    };
    return [
      toColumn("현재 견적", primary, primaryScenario, true),
      toColumn("비교 차량", comparison, compScenario, false),
    ];
  }, [primary, comparison, primaryScenario, compScenario]);

  // requiresConsultation — 회수율 데이터 없는 경우
  if (!primaryScenario || !compScenario) {
    const missingLabel = !primaryScenario
      ? `${primary.brand} ${primary.name}`
      : `${comparison.brand} ${comparison.name}`;
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-card p-4 text-center space-y-1">
        <p className="text-[14px] font-semibold text-amber-700">비교 견적을 계산할 수 없습니다</p>
        <p className="text-[12px] text-amber-600">
          <span className="font-medium">{missingLabel}</span>의 선택한 계약 유형에<br />
          대한 회수율 데이터가 없습니다. 별도 상담을 통해 확인해주세요.
        </p>
      </div>
    );
  }

  const totalCosts = columns.map(
    (c) => c.scenario.monthlyPayment * c.scenario.contractMonths + c.scenario.depositAmount + c.scenario.prepayAmount
  );

  return (
    <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card overflow-hidden">
      <div className="hidden md:block">
        <DesktopTable columns={columns} totalCosts={totalCosts} />
      </div>
      <div className="md:hidden">
        <MobileStack columns={columns} totalCosts={totalCosts} />
      </div>
    </div>
  );
}

interface RowProps {
  columns: ComparisonColumn[];
  totalCosts: number[];
}

/** 선택 옵션 요약: "2개 · 컨비니언스, 스마트센스Ⅰ" / 없으면 "없음" */
function optionSummary(names: string[]): string {
  if (names.length === 0) return "없음";
  return `${names.length}개 · ${names.join(", ")}`;
}

function colorLine(label: string, color: { name: string; priceDelta: number } | null): string {
  if (!color) return `${label} —`;
  return `${label} ${color.name}${color.priceDelta > 0 ? ` (+${formatManWon(color.priceDelta)})` : ""}`;
}

function DesktopTable({ columns, totalCosts }: RowProps) {
  const baseMonthly = columns[0].scenario.monthlyPayment;
  const baseTotal = totalCosts[0];
  const baseVehiclePrice = columns[0].totalVehiclePrice;
  const hasConfig = columns.some((c) => c.config);

  return (
    <div className="grid grid-cols-[minmax(130px,max-content)_1fr_1fr] divide-x divide-[#F0F0F0]">
      {/* Header */}
      <div className="bg-neutral" />
      {columns.map((col, i) => (
        <div key={i} className={cn("p-4", col.isPrimary ? "bg-primary-100" : "bg-white")}>
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">{col.label}</p>
          <p className="text-[12px] text-ink-caption">{col.brand}</p>
          <p className="text-[15px] font-medium text-ink leading-snug">{col.vehicleName}</p>
          <p className="text-[12px] text-ink-label mt-0.5">{col.trimName}</p>
        </div>
      ))}

      {/* 구성: 라인업 / 기본 차량가 / 옵션 / 색상 — 같은 기준의 비교인지 드러내는 정보 */}
      {hasConfig && (
        <>
          <LabelCell>라인업 (연식/엔진)</LabelCell>
          {columns.map((col, i) => (
            <ValueCell key={i}>
              <span className="text-[12px] text-ink-body leading-snug">
                {col.config?.lineupName ?? "—"}
              </span>
            </ValueCell>
          ))}

          <LabelCell>기본 차량가</LabelCell>
          {columns.map((col, i) => (
            <ValueCell key={i}>
              <span className="text-[13px] text-ink tabular-nums">{formatWon(col.basePrice)}</span>
              {col.originalPrice != null && (
                <span className="text-[11px] text-ink-caption line-through tabular-nums">
                  {formatWon(col.originalPrice)}
                </span>
              )}
            </ValueCell>
          ))}

          <LabelCell>선택 옵션</LabelCell>
          {columns.map((col, i) => (
            <ValueCell key={i}>
              <span className="text-[12px] text-ink-body leading-snug line-clamp-2" title={col.config ? optionSummary(col.config.optionNames) : undefined}>
                {col.config ? optionSummary(col.config.optionNames) : "—"}
              </span>
            </ValueCell>
          ))}

          <LabelCell>색상</LabelCell>
          {columns.map((col, i) => (
            <ValueCell key={i}>
              <span className="text-[12px] text-ink-body leading-snug">
                {col.config
                  ? `${colorLine("외장", col.config.exteriorColor)} · ${colorLine("내장", col.config.interiorColor)}`
                  : "—"}
              </span>
            </ValueCell>
          ))}
        </>
      )}

      {/* 총 차량가 */}
      <LabelCell>총 차량가 (기본+옵션+색상)</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[14px] text-ink">{formatManWon(col.totalVehiclePrice)}</span>
          {!col.isPrimary && (
            <DeltaBadge value={col.totalVehiclePrice} baseValue={baseVehiclePrice} unit="man" />
          )}
        </ValueCell>
      ))}

      {/* 월 납입금 */}
      <LabelCell highlight>월 납입금</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i} highlight>
          <span className="text-[20px] font-semibold text-ink">
            {formatWon(col.scenario.monthlyPayment)}
          </span>
          {!col.isPrimary && (
            <DeltaBadge value={col.scenario.monthlyPayment} baseValue={baseMonthly} unit="won" />
          )}
        </ValueCell>
      ))}

      {/* 보증금 */}
      <LabelCell>보증금</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[14px] text-ink-body">
            {col.scenario.depositAmount > 0 ? formatWon(col.scenario.depositAmount) : "—"}
          </span>
        </ValueCell>
      ))}

      {/* 선납금 */}
      <LabelCell>선납금</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[14px] text-ink-body">
            {col.scenario.prepayAmount > 0 ? formatWon(col.scenario.prepayAmount) : "—"}
          </span>
        </ValueCell>
      ))}

      {/* 최저가 금융사 */}
      <LabelCell>최저가 금융사</LabelCell>
      {columns.map((col, i) => (
        <ValueCell key={i}>
          <span className="text-[13px] text-ink font-medium">{col.scenario.bestFinanceCompany}</span>
        </ValueCell>
      ))}

      {/* 예상 총 비용 */}
      <LabelCell highlight>예상 총 비용</LabelCell>
      {columns.map((_, i) => (
        <ValueCell key={i} highlight>
          <span className="text-[15px] font-semibold text-ink">{formatManWon(totalCosts[i])}</span>
          {i !== 0 && (
            <DeltaBadge value={totalCosts[i]} baseValue={baseTotal} unit="man" />
          )}
          <p className="text-[11px] text-ink-caption mt-0.5">
            월 × {columns[i].scenario.contractMonths}개월 + 보증금 + 선납금
          </p>
        </ValueCell>
      ))}
    </div>
  );
}

function MobileStack({ columns, totalCosts }: RowProps) {
  const baseMonthly = columns[0].scenario.monthlyPayment;
  const baseTotal = totalCosts[0];

  return (
    <div className="divide-y divide-[#F0F0F0]">
      {columns.map((col, i) => (
        <div key={i} className={cn("p-4", col.isPrimary ? "bg-primary-100" : "bg-white")}>
          <div className="flex items-start gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-0.5">{col.label}</p>
              <p className="text-[11px] text-ink-caption">{col.brand}</p>
              <p className="text-[15px] font-medium text-ink leading-snug truncate">{col.vehicleName}</p>
              <p className="text-[12px] text-ink-label mt-0.5 truncate">{col.trimName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-ink-caption">총 차량가</p>
              <p className="text-[13px] font-medium text-ink">{formatManWon(col.totalVehiclePrice)}</p>
            </div>
          </div>

          {/* 구성 요약 — 라인업/기본 차량가/옵션/색상 */}
          {col.config && (
            <div className="bg-neutral rounded-[8px] p-3 mb-2 space-y-1 text-[11px] leading-relaxed">
              <p className="text-ink-body">
                <span className="text-ink-caption">라인업</span>{" "}
                {col.config.lineupName ?? "—"}
              </p>
              <p className="text-ink-body tabular-nums">
                <span className="text-ink-caption">기본 차량가</span> {formatWon(col.basePrice)}
                {col.originalPrice != null && (
                  <span className="text-ink-caption line-through ml-1">{formatWon(col.originalPrice)}</span>
                )}
              </p>
              <p className="text-ink-body line-clamp-2">
                <span className="text-ink-caption">옵션</span>{" "}
                {optionSummary(col.config.optionNames)}
              </p>
              <p className="text-ink-body">
                <span className="text-ink-caption">색상</span>{" "}
                {colorLine("외장", col.config.exteriorColor)} · {colorLine("내장", col.config.interiorColor)}
              </p>
            </div>
          )}

          {/* 월 납입금 */}
          <div className="bg-white rounded-[8px] border border-[#F0F0F0] p-3 mb-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <p className="text-[12px] text-ink-label">월 납입금</p>
              <div className="flex items-center flex-wrap gap-1">
                <span className="text-[20px] font-semibold text-ink">
                  {formatWon(col.scenario.monthlyPayment)}
                </span>
                {!col.isPrimary && (
                  <DeltaBadge value={col.scenario.monthlyPayment} baseValue={baseMonthly} unit="won" />
                )}
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
            <dd className="text-right text-ink font-medium">{col.scenario.bestFinanceCompany}</dd>
          </dl>

          {/* 예상 총 비용 */}
          <div className="mt-3 pt-3 border-t border-[#F0F0F0] flex items-center justify-between flex-wrap gap-1">
            <div>
              <p className="text-[12px] text-ink-label">예상 총 비용</p>
              <p className="text-[10px] text-ink-caption">
                월 × {col.scenario.contractMonths}개월 + 보증금 + 선납금
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-1">
              <span className="text-[15px] font-semibold text-ink">{formatManWon(totalCosts[i])}</span>
              {!col.isPrimary && (
                <DeltaBadge value={totalCosts[i]} baseValue={baseTotal} unit="man" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LabelCell({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("px-4 py-3 text-[12px] font-medium text-ink-label bg-neutral flex items-center", highlight && "font-semibold text-ink")}>
      {children}
    </div>
  );
}

function ValueCell({ children, highlight = false }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("px-4 py-3 flex flex-wrap items-center gap-1", highlight && "bg-primary-100/30")}>
      {children}
    </div>
  );
}
