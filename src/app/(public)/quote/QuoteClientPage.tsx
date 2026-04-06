"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Calculator,
  AlertCircle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuoteScenarioTabs } from "@/components/quote/QuoteScenarioTabs";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import type { VehicleListItem } from "@/types/api";
import type { QuoteResponse } from "@/types/api";

// ─── 상수 ────────────────────────────────────────────────
const CONTRACT_MONTHS = [36, 48, 60] as const;
const ANNUAL_MILEAGES = [10000, 20000, 30000] as const;
const CONTRACT_TYPES = ["반납형", "인수형"] as const;

type ContractMonths = (typeof CONTRACT_MONTHS)[number];
type AnnualMileage = (typeof ANNUAL_MILEAGES)[number];
type ContractType = (typeof CONTRACT_TYPES)[number];

interface Conditions {
  contractMonths: ContractMonths;
  annualMileage: AnnualMileage;
  contractType: ContractType;
}

// ─── 스텝 인디케이터 ──────────────────────────────────────
const STEPS = ["차량 선택", "조건 설정", "견적 확인"] as const;

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-300",
                  isCompleted
                    ? "bg-primary text-white"
                    : isActive
                    ? "bg-primary text-white shadow-[0_0_0_4px_rgba(0,6,102,0.15)]"
                    : "bg-neutral-800 text-ink-caption"
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={2.5} /> : step}
              </div>
              <span
                className={cn(
                  "text-[11px] mt-1.5 whitespace-nowrap",
                  isActive ? "text-primary font-medium" : "text-ink-caption"
                )}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-px mx-2 mb-5 transition-colors duration-300",
                  isCompleted ? "bg-primary" : "bg-neutral-800"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 선택 옵션 버튼 ──────────────────────────────────────
function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-5 py-2.5 rounded-btn text-[14px] font-medium transition-all duration-150 border",
        selected
          ? "bg-primary text-white border-primary"
          : "bg-white text-ink-label border-neutral-800 hover:border-secondary-400 hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}

// ─── 차량 선택 카드 ──────────────────────────────────────
function VehiclePickCard({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: VehicleListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const price = vehicle.defaultTrim?.price ?? vehicle.basePrice;
  const priceInManWon = Math.round(price / 10000);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-card border transition-all duration-200 overflow-hidden group",
        selected
          ? "border-2 border-primary shadow-card-hover"
          : "border border-[#F0F0F0] hover:border-primary-200 hover:shadow-card-hover"
      )}
    >
      {/* 썸네일 */}
      <div className="relative h-28 bg-neutral overflow-hidden">
        {vehicle.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.thumbnailUrl}
            alt={vehicle.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-caption text-[12px]">
            이미지 준비중
          </div>
        )}
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
            <Check size={13} className="text-white" strokeWidth={2.5} />
          </div>
        )}
        {vehicle.isPopular && !selected && (
          <div className="absolute top-2 right-2 bg-primary-100 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-[4px]">
            인기
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-[11px] text-ink-caption mb-0.5">{vehicle.brand}</p>
        <p className="text-[14px] font-medium text-ink leading-snug">
          {vehicle.name}
        </p>
        {vehicle.defaultTrim && (
          <p className="text-[12px] text-secondary mt-1">
            {vehicle.defaultTrim.engineType} · {vehicle.defaultTrim.name}
          </p>
        )}
        <p className="text-[12px] text-ink-label mt-1.5">
          차량가 <span className="font-medium text-ink">{priceInManWon.toLocaleString()}만원~</span>
        </p>
      </div>
    </button>
  );
}

// ─── 메인 ────────────────────────────────────────────────
export function QuoteClientPage({ vehicles }: { vehicles: VehicleListItem[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [search, setSearch] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleListItem | null>(null);
  const [conditions, setConditions] = useState<Conditions>({
    contractMonths: 48,
    annualMileage: 20000,
    contractType: "반납형",
  });
  const [quoteResult, setQuoteResult] = useState<QuoteResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 차량 필터
  const filteredVehicles = vehicles.filter((v) =>
    search.trim() === ""
      ? true
      : v.name.includes(search) || v.brand.includes(search)
  );

  // Step 2 → Step 3: 견적 계산 API 호출
  async function fetchQuote() {
    if (!selectedVehicle) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/vehicles/${selectedVehicle.slug}/quote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractMonths: conditions.contractMonths,
            annualMileage: conditions.annualMileage,
            contractType: conditions.contractType,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "견적 계산에 실패했습니다.");
        return;
      }

      setQuoteResult(json.data as QuoteResponse);
      setStep(3);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral">
      {/* 페이지 헤더 */}
      <div
        className="border-b border-[#F0F0F0] bg-white"
      >
        <div className="page-container py-8">
          <div className="flex items-center gap-2 mb-1">
            <Calculator size={16} className="text-primary" />
            <span className="text-[11px] font-semibold text-ink-caption uppercase tracking-[0.15em]">
              견적 계산
            </span>
          </div>
          <h1 className="text-headline-sm font-light text-ink">
            조건을 설정하면 실시간으로 계산됩니다
          </h1>
          <p className="text-[14px] text-ink-label mt-1">
            개인정보 없이, 보수형·표준형·공격형 3가지 시나리오를 바로 확인하세요
          </p>
        </div>
      </div>

      <div className="page-container py-8">
        <div className="max-w-3xl mx-auto">
          <StepBar currentStep={step} />

          <AnimatePresence mode="wait">
            {/* ── STEP 1: 차량 선택 ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card p-6 mb-4">
                  <h2 className="text-[17px] font-medium text-ink mb-4">
                    견적을 확인할 차량을 선택하세요
                  </h2>

                  {/* 검색 */}
                  <div className="relative mb-5">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-caption"
                    />
                    <input
                      type="text"
                      placeholder="차량명 또는 브랜드로 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-[14px] border border-neutral-800 rounded-btn
                                 placeholder:text-ink-caption focus:outline-none focus:border-primary
                                 transition-colors duration-150"
                    />
                  </div>

                  {/* 차량 그리드 */}
                  {filteredVehicles.length === 0 ? (
                    <div className="text-center py-10 text-ink-caption text-[14px]">
                      검색 결과가 없습니다
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {filteredVehicles.map((v) => (
                        <VehiclePickCard
                          key={v.id}
                          vehicle={v}
                          selected={selectedVehicle?.id === v.id}
                          onSelect={() => setSelectedVehicle(v)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* 다음 버튼 */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedVehicle}
                    onClick={() => setStep(2)}
                    className={cn(
                      "inline-flex items-center gap-2 px-6 py-3 rounded-btn text-[14px] font-medium transition-all duration-200",
                      selectedVehicle
                        ? "bg-primary text-white hover:opacity-90"
                        : "bg-neutral-800 text-ink-caption cursor-not-allowed"
                    )}
                  >
                    조건 설정하기
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: 조건 설정 ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card p-6 mb-4">
                  {/* 선택된 차량 요약 */}
                  {selectedVehicle && (
                    <div className="flex items-center gap-3 p-3 bg-primary-100 rounded-[8px] border border-primary-200 mb-6">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check size={14} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[12px] text-ink-caption">선택된 차량</p>
                        <p className="text-[14px] font-medium text-primary">
                          {selectedVehicle.name}
                          {selectedVehicle.defaultTrim && (
                            <span className="text-ink-label font-normal ml-1.5">
                              {selectedVehicle.defaultTrim.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="ml-auto text-[12px] text-ink-caption hover:text-primary transition-colors"
                      >
                        변경
                      </button>
                    </div>
                  )}

                  <h2 className="text-[17px] font-medium text-ink mb-6">
                    계약 조건을 설정하세요
                  </h2>

                  {/* 계약기간 */}
                  <div className="mb-6">
                    <p className="text-[13px] font-medium text-ink-label mb-3">
                      계약기간
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CONTRACT_MONTHS.map((m) => (
                        <OptionButton
                          key={m}
                          selected={conditions.contractMonths === m}
                          onClick={() =>
                            setConditions((prev) => ({ ...prev, contractMonths: m }))
                          }
                        >
                          {m}개월
                        </OptionButton>
                      ))}
                    </div>
                  </div>

                  {/* 약정거리 */}
                  <div className="mb-6">
                    <p className="text-[13px] font-medium text-ink-label mb-3">
                      연간 약정거리
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ANNUAL_MILEAGES.map((m) => (
                        <OptionButton
                          key={m}
                          selected={conditions.annualMileage === m}
                          onClick={() =>
                            setConditions((prev) => ({ ...prev, annualMileage: m }))
                          }
                        >
                          연 {(m / 10000).toFixed(0)}만km
                        </OptionButton>
                      ))}
                    </div>
                  </div>

                  {/* 계약 종류 */}
                  <div>
                    <p className="text-[13px] font-medium text-ink-label mb-1.5">
                      계약 종류
                    </p>
                    <p className="text-[12px] text-ink-caption mb-3">
                      반납형: 계약 종료 후 반납, 전액 비용처리 가능 ·
                      인수형: 잔존가치로 차량 매입
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CONTRACT_TYPES.map((t) => (
                        <OptionButton
                          key={t}
                          selected={conditions.contractType === t}
                          onClick={() =>
                            setConditions((prev) => ({ ...prev, contractType: t }))
                          }
                        >
                          {t}
                        </OptionButton>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 안내 메시지 */}
                <div className="bg-white rounded-[8px] border border-[#F0F0F0] p-4 text-[13px] text-ink-label mb-4 flex items-start gap-2">
                  <Sparkles size={13} className="text-primary shrink-0 mt-0.5" />
                  <p>
                    보수형(보증금 있음)·표준형(균형)·공격형(선납금 있음) 3가지
                    시나리오를 한 번에 확인할 수 있습니다.
                  </p>
                </div>

                {/* 에러 */}
                {error && (
                  <div className="bg-[#FFEBEB] border border-red-100 rounded-[8px] p-4 text-[13px] text-destructive flex items-start gap-2 mb-4">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">견적 데이터를 불러올 수 없습니다</p>
                      <p className="mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 text-[13px] text-ink-caption hover:text-ink transition-colors"
                  >
                    <ChevronLeft size={15} />
                    차량 다시 선택
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={fetchQuote}
                    className={cn(
                      "inline-flex items-center gap-2 px-6 py-3 rounded-btn text-[14px] font-medium transition-all duration-200",
                      isLoading
                        ? "bg-neutral-800 text-ink-caption cursor-not-allowed"
                        : "bg-primary text-white hover:opacity-90"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        계산 중...
                      </>
                    ) : (
                      <>
                        견적 계산하기
                        <Calculator size={15} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 3: 견적 결과 ── */}
            {step === 3 && quoteResult && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* 조건 요약 배너 */}
                <div className="bg-primary-100 border border-primary-200 rounded-card p-4 mb-4">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
                    <span className="font-medium text-primary">
                      {quoteResult.trimName
                        ? `${selectedVehicle?.name} · ${quoteResult.trimName}`
                        : selectedVehicle?.name}
                    </span>
                    <span className="text-ink-label">
                      계약 {quoteResult.contractMonths}개월
                    </span>
                    <span className="text-ink-label">
                      연 {(quoteResult.annualMileage / 10000).toFixed(0)}만km
                    </span>
                    <span className="text-ink-label">{quoteResult.contractType}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(2);
                        setQuoteResult(null);
                        setError(null);
                      }}
                      className="ml-auto text-[12px] text-ink-caption hover:text-primary transition-colors shrink-0"
                    >
                      조건 변경
                    </button>
                  </div>
                </div>

                {/* 시나리오 탭 */}
                <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card p-6 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={14} className="text-primary" />
                    <p className="text-[13px] text-ink-label">
                      아래 탭을 클릭해 3가지 시나리오를 비교하세요
                    </p>
                  </div>
                  <QuoteScenarioTabs scenarios={quoteResult.scenarios} />
                </div>

                {/* 면책 안내 */}
                <div className="bg-neutral rounded-[8px] border border-[#F0F0F0] p-4 text-[12px] text-ink-caption mb-4 leading-relaxed">
                  위 견적은 실제 계약 가능한 기준으로 계산되었으나, 최종 금액은
                  차량 상태·옵션·프로모션에 따라 달라질 수 있습니다. 전문가
                  상담을 통해 확정 견적을 받으시길 권장합니다.
                </div>

                {/* 상담 버튼 */}
                <ChannelTalkButton vehicleName={selectedVehicle?.name} />

                {/* 하단 링크 */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F0F0]">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setSelectedVehicle(null);
                      setQuoteResult(null);
                      setError(null);
                      setSearch("");
                    }}
                    className="text-[13px] text-ink-caption hover:text-ink transition-colors"
                  >
                    ← 다른 차량 계산하기
                  </button>
                  <Link
                    href={`/cars/${selectedVehicle?.slug}`}
                    className="text-[13px] text-primary hover:underline"
                  >
                    차량 상세 보기 →
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AI 추천 배너 */}
      {step === 1 && (
        <div className="page-container pb-12">
          <div className="max-w-3xl mx-auto">
            <div
              className="rounded-card overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
              }}
            >
              <div className="px-6 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={13} className="text-white/60" />
                    <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                      어떤 차가 맞는지 모르겠다면?
                    </span>
                  </div>
                  <p className="text-[16px] font-light text-white">
                    AI 추천으로 먼저 차량을 찾아보세요
                  </p>
                </div>
                <Link
                  href="/recommend"
                  className="shrink-0 inline-flex items-center gap-2 bg-white text-primary
                             text-[13px] font-semibold px-5 py-2.5 rounded-btn
                             hover:bg-primary-100 transition-colors duration-200"
                >
                  AI 추천 받기
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
