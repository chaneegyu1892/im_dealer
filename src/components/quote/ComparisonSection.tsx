"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, GitCompare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComparisonSlotPicker, type ComparisonSelection } from "./ComparisonSlotPicker";
import { ComparisonTable } from "./ComparisonTable";
import type { VehicleListItem, QuoteResponse } from "@/types/api";

type ScenarioKey = "conservative" | "standard" | "aggressive";

export interface PrimaryVehicleInfo {
  slug: string;
  brand: string;
  name: string;
  result: QuoteResponse;
}

export interface ContractConditions {
  contractMonths: 36 | 48 | 60;
  annualMileage: 10000 | 20000 | 30000;
  contractType: "반납형" | "인수형";
  productType: "장기렌트" | "리스";
}

interface ComparisonSectionProps {
  primary: PrimaryVehicleInfo;
  conditions: ContractConditions;
  allVehicles: VehicleListItem[];
}

export function ComparisonSection({
  primary,
  conditions,
  allVehicles,
}: ComparisonSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selection, setSelection] = useState<ComparisonSelection | null>(null);
  const [result, setResult] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioKey>("standard");

  const abortRef = useRef<AbortController | null>(null);

  // 비교 차량의 메타 정보
  const comparisonVehicleMeta = useMemo(() => {
    if (!selection) return null;
    return allVehicles.find((v) => v.slug === selection.slug) ?? null;
  }, [selection, allVehicles]);

  // 선택/조건 변경 시 견적 계산
  useEffect(() => {
    if (!selection || !selection.slug || !selection.trimId) {
      abortRef.current?.abort();
      return;
    }
    const currentSelection = selection;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    async function fetchComparisonQuote() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/vehicles/${currentSelection.slug}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trimId: currentSelection.trimId,
            selectedOptionIds: [],
            contractMonths: conditions.contractMonths,
            annualMileage: conditions.annualMileage,
            contractType: conditions.contractType,
            productType: conditions.productType,
          }),
          signal: ctrl.signal,
        });
        const json = await response.json();
        if (ctrl.signal.aborted) return;
        if (!json.success) {
          setError(json.error ?? "견적 계산에 실패했습니다.");
          setResult(null);
          return;
        }
        setResult(json.data as QuoteResponse);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("네트워크 오류가 발생했습니다.");
        setResult(null);
      } finally {
        if (!ctrl.signal.aborted) setIsLoading(false);
      }
    }

    void fetchComparisonQuote();

    return () => ctrl.abort();
  }, [selection, conditions]);

  function handleRemove() {
    abortRef.current?.abort();
    setSelection(null);
    setResult(null);
    setError(null);
  }

  return (
    <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card overflow-hidden mb-4">
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-neutral transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
          <GitCompare size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-ink">다른 차량과 비교하기</p>
          <p className="text-[12px] text-ink-caption mt-0.5">
            동일 조건으로 다른 차량 견적을 나란히 비교할 수 있습니다
          </p>
        </div>
        <span
          className={cn(
            "text-[12px] font-medium text-primary shrink-0 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        >
          ▾
        </span>
      </button>

      {/* 바디 */}
      {isOpen && (
        <div className="border-t border-[#F0F0F0] p-4 md:p-5 bg-neutral/40 space-y-4">
          {!selection && (
            <AddSlotButton onAdd={() => setSelection({ slug: "", trimId: "", trimPrice: 0 })} />
          )}

          {selection && (
            <ComparisonSlotPicker
              allVehicles={allVehicles}
              excludeSlug={primary.slug}
              value={selection.slug ? selection : null}
              onChange={(s) => {
                setSelection(s ?? { slug: "", trimId: "", trimPrice: 0 });
                if (!s) {
                  setResult(null);
                  setError(null);
                  setIsLoading(false);
                }
              }}
              onRemove={handleRemove}
            />
          )}

          {selection?.slug && isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-ink-caption">
              <span className="w-4 h-4 border-2 border-neutral-700 border-t-primary rounded-full animate-spin" />
              비교 견적 계산 중...
            </div>
          )}

          {error && (
            <div className="bg-error-bg border border-red-100 rounded-[8px] p-3 text-[13px] text-error-text flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {result && comparisonVehicleMeta && selection?.slug && !isLoading && (
            <ComparisonTable
              primary={{
                brand: primary.brand,
                name: primary.name,
                result: primary.result,
              }}
              comparison={{
                brand: comparisonVehicleMeta.brand,
                name: comparisonVehicleMeta.name,
                result,
              }}
              scenario={scenario}
              onScenarioChange={setScenario}
            />
          )}

          {/* 비교 조건 안내 */}
          {selection?.slug && (
            <p className="text-[11px] text-ink-caption text-center">
              비교 조건 — 계약 {conditions.contractMonths}개월 · 연 {(conditions.annualMileage / 10000).toFixed(0)}만km · {conditions.contractType} · {conditions.productType}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AddSlotButton({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full flex items-center justify-center gap-2 py-4 rounded-card border-2 border-dashed border-neutral-800 hover:border-primary hover:bg-primary-100/40 transition-colors text-[14px] text-ink-label hover:text-primary"
    >
      <Plus size={16} />
      비교할 차량 추가
    </button>
  );
}
