"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatMonthly } from "@/lib/utils";
import type { RecommendScenarios } from "@/types/recommendation";
import type { QuoteScenario } from "@/types/quote";

const TABS: { key: keyof RecommendScenarios; label: QuoteScenario; desc: string }[] = [
  { key: "conservative", label: "보수형", desc: "보증금 있음 · 월납입 ↓" },
  { key: "standard",     label: "표준형", desc: "균형 조건 · 추천" },
  { key: "aggressive",   label: "공격형", desc: "선납금 있음 · 월납입 최소" },
];

interface QuoteScenarioTabsProps {
  scenarios: RecommendScenarios;
  defaultTab?: keyof RecommendScenarios;
}

export function QuoteScenarioTabs({
  scenarios,
  defaultTab = "standard",
}: QuoteScenarioTabsProps) {
  const [active, setActive] = useState<keyof RecommendScenarios>(defaultTab);
  const data = scenarios[active];

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex border-b border-neutral-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors duration-150 relative",
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
      <div className="pt-4 space-y-4">
        {/* 월 납입금 — 핵심 숫자 */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-caption text-ink-caption">월 납입금</p>
            <p className="text-[28px] font-light text-ink leading-none mt-1">
              {formatMonthly(data.monthlyPayment)}
            </p>
          </div>
          <span
            className={cn(
              "text-[11px] font-medium rounded-pill px-2.5 py-1",
              active === "standard"
                ? "bg-primary text-white"
                : "bg-neutral-800 text-ink-label"
            )}
          >
            {TABS.find((t) => t.key === active)?.label}
          </span>
        </div>

        {/* 조건 그리드 */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[13px]">
          <ConditionRow
            label="계약기간"
            value={`${data.contractMonths}개월`}
          />
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
          <ConditionRow
            label="계약 종류"
            value={data.contractType}
          />
        </div>

        {/* 비용처리 체크포인트 */}
        <CostCheckpoint contractType={data.contractType} />
      </div>
    </div>
  );
}

function ConditionRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-ink-caption">{label}</p>
      <p className="font-medium text-ink mt-0.5">{value}</p>
    </div>
  );
}

function CostCheckpoint({ contractType }: { contractType: string }) {
  const points =
    contractType === "인수형"
      ? ["잔존가치로 차량 최종 매입", "감가상각 비용처리 가능 (법인)"]
      : ["계약 종료 후 반납, 교체 자유", "전액 비용처리 가능 (법인/개인사업자)"];

  return (
    <div className="rounded-[6px] bg-neutral p-3 space-y-1.5">
      <p className="text-[11px] font-medium text-ink-label">체크포인트</p>
      {points.map((p) => (
        <p key={p} className="text-[12px] text-ink-caption flex items-start gap-1.5">
          <span className="text-primary mt-0.5">•</span>
          {p}
        </p>
      ))}
    </div>
  );
}
