"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import type { AdminQuoteCalculation } from "@/types/admin";

const PAGE_SIZE = 50;

interface QuoteCalculationResponse {
  success: boolean;
  data: AdminQuoteCalculation[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
  error?: string;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatMileage(value: number) {
  return `${(value / 10_000).toLocaleString("ko-KR")}만km/년`;
}

function formatInitialCost(calculation: AdminQuoteCalculation) {
  if (calculation.depositRate > 0) return `보증금 ${calculation.depositRate}%`;
  if (calculation.prepayRate > 0) return `선납금 ${calculation.prepayRate}%`;
  return "초기비용 없음";
}

function formatScenario(value: string) {
  if (value === "conservative") return "보증금형";
  if (value === "aggressive") return "선납형";
  return "기본형";
}

function formatCustomerType(value: string | null) {
  const labels: Record<string, string> = {
    individual: "개인",
    self_employed: "개인사업자",
    corporate: "법인",
    nonprofit: "비영리법인",
  };
  return value ? labels[value] ?? value : null;
}

export function QuoteCalculationHistory() {
  const [calculations, setCalculations] = useState<AdminQuoteCalculation[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/admin/quote-calculations?page=${page}&limit=${PAGE_SIZE}`)
      .then(async (response) => {
        const payload = (await response.json()) as QuoteCalculationResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "견적 계산 이력을 불러오지 못했습니다.");
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setCalculations(payload.data);
        setTotal(payload.meta.total);
      })
      .catch((fetchError: unknown) => {
        if (cancelled) return;
        console.error("[QuoteCalculationHistory] fetch failed", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "견적 계산 이력을 불러오지 못했습니다."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, requestVersion]);

  const refreshCalculations = () => {
    setLoading(true);
    setError(null);
    setRequestVersion((current) => current + 1);
  };

  const movePage = (nextPage: number) => {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#F8F9FC]">
      <div className="flex shrink-0 items-center justify-between border-b border-[#E8EAF0] bg-[#FAFBFF] px-6 py-3">
        <div>
          <p className="text-[12px] font-semibold text-[#1A1A2E]">
            견적만 확인한 고객 기록
          </p>
          <p className="mt-0.5 text-[11px] text-[#9BA4C0]">
            상담·계약 신청 단계로 넘어간 견적은 제외됩니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#E5E5FA] px-3 py-1 text-[11px] font-semibold text-[#000666]">
            총 {total.toLocaleString("ko-KR")}건
          </span>
          <button
            type="button"
            onClick={refreshCalculations}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-[6px] border border-[#E8EAF0] bg-white px-3 py-1.5 text-[11px] font-medium text-[#6B7399] transition-colors hover:border-[#C0C5DC] hover:text-[#000666] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : undefined} />
            새로고침
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-[#9BA4C0]">
            <Calculator size={28} className="animate-pulse text-[#6066EE]" />
            <p className="text-[12px]">견적 계산 이력을 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3">
            <AlertCircle size={28} className="text-[#E23B4A]" />
            <p className="text-[12px] text-[#6B7399]">{error}</p>
            <button
              type="button"
              onClick={refreshCalculations}
              className="rounded-[6px] bg-[#000666] px-4 py-2 text-[11px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        ) : calculations.length === 0 ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 text-[#9BA4C0]">
            <Calculator size={30} />
            <p className="text-[12px]">저장된 견적 계산 이력이 없습니다.</p>
          </div>
        ) : (
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="sticky top-0 z-[1] bg-[#F4F5F8]">
              <tr className="border-b border-[#E8EAF0] text-[11px] font-semibold text-[#6B7399]">
                <th className="px-5 py-3">계산 시각</th>
                <th className="px-5 py-3">차량 / 트림</th>
                <th className="px-5 py-3">이용자</th>
                <th className="px-5 py-3">상품 / 조건</th>
                <th className="px-5 py-3">초기비용</th>
                <th className="px-5 py-3 text-right">월 납입금</th>
                <th className="px-5 py-3">금융사</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF0F5] bg-white">
              {calculations.map((calculation) => (
                <tr key={calculation.id} className="transition-colors hover:bg-[#FAFBFF]">
                  <td className="whitespace-nowrap px-5 py-4 text-[11px] text-[#6B7399]">
                    {formatDateTime(calculation.calculatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <p className="max-w-[220px] truncate text-[12px] font-semibold text-[#1A1A2E]">
                      {calculation.vehicleName}
                    </p>
                    <p className="mt-1 max-w-[220px] truncate text-[11px] text-[#9BA4C0]">
                      {calculation.vehicleBrand ? `${calculation.vehicleBrand} · ` : ""}
                      {calculation.trimName ?? "트림 정보 없음"}
                    </p>
                    {calculation.optionCount > 0 && (
                      <p
                        className="mt-1 max-w-[220px] truncate text-[10px] text-[#6B7399]"
                        title={calculation.selectedOptions
                          .map((option) => `${option.name} (${option.price.toLocaleString("ko-KR")}원)`)
                          .join(", ")}
                      >
                        옵션 {calculation.selectedOptions.map((option) => option.name).join(", ")}
                      </p>
                    )}
                    {(calculation.exteriorColorName || calculation.interiorColorName) && (
                      <p className="mt-1 max-w-[220px] truncate text-[10px] text-[#9BA4C0]">
                        색상 {[calculation.exteriorColorName, calculation.interiorColorName]
                          .filter(Boolean)
                          .join(" / ")}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {calculation.userType === "Member" ? (
                      <>
                        <p className="text-[12px] font-medium text-[#1A1A2E]">
                          {calculation.customerName ?? "회원"}
                        </p>
                        <p className="mt-1 text-[11px] text-[#9BA4C0]">
                          {calculation.phone ?? "연락처 없음"}
                        </p>
                      </>
                    ) : (
                      <span className="rounded-full bg-[#F4F5F8] px-2.5 py-1 text-[11px] font-medium text-[#6B7399]">
                        비회원
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-[12px] font-medium text-[#1A1A2E]">
                      {calculation.productType} · {calculation.contractType} · {formatScenario(calculation.scenarioType)}
                    </p>
                    <p className="mt-1 text-[11px] text-[#9BA4C0]">
                      {calculation.contractMonths}개월 · {formatMileage(calculation.annualMileage)}
                    </p>
                    {formatCustomerType(calculation.customerType) && (
                      <p className="mt-1 text-[10px] text-[#9BA4C0]">
                        {formatCustomerType(calculation.customerType)} 고객
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <p className="text-[12px] text-[#4A5270]">
                      {formatInitialCost(calculation)}
                    </p>
                    {calculation.totalVehiclePrice !== null && (
                      <p className="mt-1 text-[10px] text-[#9BA4C0]">
                        차량가 {calculation.totalVehiclePrice.toLocaleString("ko-KR")}원
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right text-[13px] font-bold text-[#000666]">
                    {calculation.pricingStatus === "CONSULTATION_REQUIRED"
                      ? "별도 상담"
                      : `${calculation.resultMonthly.toLocaleString("ko-KR")}원`}
                  </td>
                  <td className="px-5 py-4 text-[12px] text-[#4A5270]">
                    {calculation.bestFinanceCompany || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && !error && total > 0 && (
        <div className="flex shrink-0 items-center justify-between border-t border-[#E8EAF0] bg-white px-6 py-3">
          <p className="text-[11px] text-[#9BA4C0]">
            {((page - 1) * PAGE_SIZE + 1).toLocaleString("ko-KR")}–
            {Math.min(page * PAGE_SIZE, total).toLocaleString("ko-KR")} / {total.toLocaleString("ko-KR")}건
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="이전 페이지"
              onClick={() => movePage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-[6px] border border-[#E8EAF0] p-1.5 text-[#6B7399] transition-colors hover:border-[#C0C5DC] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[56px] text-center text-[11px] font-semibold text-[#1A1A2E]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              aria-label="다음 페이지"
              onClick={() => movePage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-[6px] border border-[#E8EAF0] p-1.5 text-[#6B7399] transition-colors hover:border-[#C0C5DC] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
