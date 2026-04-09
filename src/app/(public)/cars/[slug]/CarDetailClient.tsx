"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Info,
  ChevronRight,
  Images,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuoteBreakdownTabs } from "@/components/quote/QuoteBreakdownTabs";
import { AiInsight } from "@/components/quote/AiInsight";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import type { VehicleDetail, VehicleDetailTrim, QuoteResponse } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import type { QuoteScenarioDetails } from "@/types/quote";
import type { RecommendScenarios } from "@/types/recommendation";

// ── 상수 ───────────────────────────────────────────────────
const CONTRACT_MONTHS = [36, 48, 60] as const;
const ANNUAL_MILEAGES = [10_000, 20_000, 30_000] as const;
type ContractMonths = (typeof CONTRACT_MONTHS)[number];
type AnnualMileage = (typeof ANNUAL_MILEAGES)[number];
type ContractType = "반납형" | "인수형";

const TRUST_ITEMS = [
  "허위·낚시 견적 없음",
  "개인정보 없이 견적 확인",
  "상담 압박 없음",
  "실제 운영 가능한 조건만",
];

const ENGINE_LABEL: Record<EngineType, string> = {
  EV: "전기차",
  하이브리드: "하이브리드",
  가솔린: "가솔린",
  디젤: "디젤",
};

// ── 캐스케이딩 셀렉트 ─────────────────────────────────────
function CascadeSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-ink-caption uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-[#E5E5E5] rounded-[10px]
                     px-4 py-2.5 text-[13px] text-ink pr-9
                     focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10
                     transition-colors duration-150 cursor-pointer"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-caption pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

// ── 유틸 ───────────────────────────────────────────────────
function formatWon(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}천만원`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}
function formatMonthlyShort(n: number) {
  return `${Math.round(n / 10_000)}만원`;
}

// ══════════════════════════════════════════════════════════
// CarDetailClient
// ══════════════════════════════════════════════════════════
export function CarDetailClient({ vehicle }: { vehicle: VehicleDetail }) {
  // ── 캐스케이딩 트림 선택 상태 ─────────────────────────────
  const hasCascade = vehicle.trims.some((t) => (t.specs as Record<string, string> | null)?.lineup);
  const availableLineups = hasCascade
    ? (() => {
        const all = [...new Set(vehicle.trims.map((t) => (t.specs as Record<string, string>)?.lineup ?? "").filter(Boolean))];
        const getYear = (s: string) => parseInt(s.match(/\d{4}/)?.[0] ?? "0");
        const getGroup = (s: string) => s.replace(/^\d{4}년형\s*/, "");
        // 그룹 등장 순서 유지
        const groupOrder: string[] = [];
        for (const l of all) {
          const g = getGroup(l);
          if (!groupOrder.includes(g)) groupOrder.push(g);
        }
        return all.sort((a, b) => {
          const ga = getGroup(a), gb = getGroup(b);
          const gi = groupOrder.indexOf(ga) - groupOrder.indexOf(gb);
          if (gi !== 0) return gi;
          return getYear(b) - getYear(a); // 같은 그룹이면 최신연도 우선
        });
      })()
    : [];
  const [selectedLineup, setSelectedLineup] = useState<string | null>(
    availableLineups[0] ?? null
  );
  const [selectedTrimName, setSelectedTrimName] = useState<string | null>(null);

  const trimsForLineup = selectedLineup
    ? vehicle.trims.filter((t) => (t.specs as Record<string, string>)?.lineup === selectedLineup)
    : vehicle.trims;
  const availableTrimNames = [
    ...new Map(
      trimsForLineup.map((t) => {
        const name = (t.specs as Record<string, string>)?.trimName ?? t.name;
        return [name, { name, price: t.price, id: t.id }];
      })
    ).values(),
  ];

  // 최종 선택된 트림 (캐스케이딩 또는 flat)
  const selectedTrim: VehicleDetailTrim | undefined = hasCascade
    ? (selectedTrimName
        ? trimsForLineup.find((t) => (t.specs as Record<string, string>)?.trimName === selectedTrimName)
        : undefined)
    : vehicle.trims.find((t) => t.id === selectedLineup) ?? vehicle.trims[0];
  const selectedTrimId = selectedTrim?.id ?? vehicle.defaultTrim?.id ?? vehicle.trims[0]?.id ?? "";

  // 견적 플로우 가시성
  const [quoteVisible, setQuoteVisible] = useState(false);
  const quoteAnchorRef = useRef<HTMLDivElement>(null);

  // 견적 조건
  const [contractMonths, setContractMonths] = useState<ContractMonths>(48);
  const [annualMileage, setAnnualMileage] = useState<AnnualMileage>(20_000);
  const [contractType, setContractType] = useState<ContractType>("반납형");

  // 견적 데이터
  const [detailedScenarios, setDetailedScenarios] =
    useState<QuoteScenarioDetails | null>(null);
  // 사이드바용 초기 시나리오 (서버에서 받은 간단 버전)
  const [simpleScenarios, setSimpleScenarios] =
    useState<RecommendScenarios | null>(vehicle.scenarios);
  const [isLoading, setIsLoading] = useState(false);

  // 이미지 갤러리 선택
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const engineType = (selectedTrim?.engineType ?? "가솔린") as EngineType;

  // ── 현재 월납입 (사이드바 표시용) ────────────────────────
  const currentMonthly =
    detailedScenarios?.standard?.monthlyPayment ??
    simpleScenarios?.standard?.monthlyPayment;

  // ── 견적 API 호출 ─────────────────────────────────────────
  const fetchQuote = useCallback(
    async (
      months: number,
      mileage: number,
      type: string,
      trimId: string,
    ) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/vehicles/${vehicle.slug}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trimId,
            contractMonths: months,
            annualMileage: mileage,
            contractType: type,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data as QuoteResponse;
          setDetailedScenarios(data.scenarios);
          // 사이드바용 간단 버전 동기화
          setSimpleScenarios({
            conservative: {
              monthlyPayment: data.scenarios.conservative.monthlyPayment,
              depositAmount: data.scenarios.conservative.depositAmount,
              prepayAmount: data.scenarios.conservative.prepayAmount,
              contractMonths: data.scenarios.conservative.contractMonths,
              annualMileage: data.scenarios.conservative.annualMileage,
              contractType: data.scenarios.conservative.contractType,
            },
            standard: {
              monthlyPayment: data.scenarios.standard.monthlyPayment,
              depositAmount: data.scenarios.standard.depositAmount,
              prepayAmount: data.scenarios.standard.prepayAmount,
              contractMonths: data.scenarios.standard.contractMonths,
              annualMileage: data.scenarios.standard.annualMileage,
              contractType: data.scenarios.standard.contractType,
            },
            aggressive: {
              monthlyPayment: data.scenarios.aggressive.monthlyPayment,
              depositAmount: data.scenarios.aggressive.depositAmount,
              prepayAmount: data.scenarios.aggressive.prepayAmount,
              contractMonths: data.scenarios.aggressive.contractMonths,
              annualMileage: data.scenarios.aggressive.annualMileage,
              contractType: data.scenarios.aggressive.contractType,
            },
          });
        }
      } catch {
        // 기존 상태 유지
      } finally {
        setIsLoading(false);
      }
    },
    [vehicle.slug],
  );

  // ── 트림 선택 핸들러 (캐스케이딩 최종 선택 시 호출) ─────
  const handleTrimSelect = (trim: VehicleDetailTrim) => {
    if (!quoteVisible) setQuoteVisible(true);
    fetchQuote(contractMonths, annualMileage, contractType, trim.id);
    setTimeout(() => {
      quoteAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  };

  // 트림명 선택 시 자동으로 견적 호출
  const handleTrimNameSelect = (trimName: string) => {
    setSelectedTrimName(trimName);
    const trim = trimsForLineup.find(
      (t) => (t.specs as Record<string, string>)?.trimName === trimName
    );
    if (trim) handleTrimSelect(trim);
  };

  // ── 조건 변경 핸들러 ─────────────────────────────────────
  const handleMonthsChange = (m: ContractMonths) => {
    setContractMonths(m);
    if (quoteVisible) fetchQuote(m, annualMileage, contractType, selectedTrimId);
  };
  const handleMileageChange = (km: AnnualMileage) => {
    setAnnualMileage(km);
    if (quoteVisible) fetchQuote(contractMonths, km, contractType, selectedTrimId);
  };
  const handleTypeChange = (type: ContractType) => {
    setContractType(type);
    if (quoteVisible) fetchQuote(contractMonths, annualMileage, type, selectedTrimId);
  };

  const aiReason =
    vehicle.aiCaption ?? `${vehicle.name}은(는) 이 조건에 적합한 차량입니다.`;

  // 갤러리 이미지 목록 (thumbnailUrl + imageUrls 중복 제거)
  const allImages = vehicle.imageUrls.length > 0
    ? vehicle.imageUrls
    : vehicle.thumbnailUrl
    ? [vehicle.thumbnailUrl]
    : [];
  const heroImage = vehicle.thumbnailUrl || allImages[0] || "";

  // ── 트림 옵션 카테고리 그룹 ──────────────────────────────
  function groupOptions(options: VehicleDetailTrim["options"]) {
    return options.reduce<Record<string, VehicleDetailTrim["options"]>>(
      (acc, opt) => {
        const cat = opt.category ?? "기타";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(opt);
        return acc;
      },
      {},
    );
  }

  // ═════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-neutral">

      {/* ──────────────────────────────────────────────────
          HERO: 차량 이미지 배경 + 어두운 오버레이 + 텍스트
      ────────────────────────────────────────────────── */}
      <section className="relative h-[62vh] min-h-[500px] overflow-hidden">
        {/* 배경 이미지 */}
        {heroImage && (
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{
              backgroundImage: `url(${heroImage})`,
              transition: "background-image 0.5s ease",
            }}
          />
        )}

        {/* 다중 오버레이: 하단에서 올라오는 어두운 그라디언트 */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/35 to-transparent" />

        {/* 콘텐츠 */}
        <div className="relative z-10 h-full flex flex-col justify-between page-container">
          {/* 뒤로가기 */}
          <div className="pt-6">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Link
                href="/cars"
                className="inline-flex items-center gap-1.5 text-white/55 hover:text-white/90
                           text-[12px] font-medium transition-colors duration-150 group"
              >
                <ArrowLeft
                  size={13}
                  className="group-hover:-translate-x-0.5 transition-transform duration-150"
                />
                차량 목록
              </Link>
            </motion.div>
          </div>

          {/* 차량 기본 정보 + 월납입 카드 */}
          <div className="pb-10 flex items-end justify-between gap-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="flex-1"
            >
              {/* 배지 행 */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.18em]">
                  {vehicle.brand}
                </span>
                <span className="text-white/25">·</span>
                <span className="text-[11px] text-white/45">{vehicle.category}</span>
                <span className="text-[10px] font-semibold bg-white/15 text-white/80 px-2 py-0.5 rounded-[4px] ml-1 backdrop-blur-sm">
                  {ENGINE_LABEL[engineType]}
                </span>
                {vehicle.isPopular && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 text-white/80 px-2 py-0.5 rounded-[4px] backdrop-blur-sm">
                    <Sparkles size={9} />
                    인기
                  </span>
                )}
              </div>

              {/* 차량명 */}
              <h1 className="font-display text-[54px] font-light text-white leading-none tracking-tight mb-3 drop-shadow-md">
                {vehicle.name}
              </h1>

              {/* 설명 */}
              {vehicle.description && (
                <p className="text-white/55 text-[14px] leading-relaxed max-w-lg">
                  {vehicle.description}
                </p>
              )}

              {/* 공통 스펙 배지 */}
              <div className="flex items-center gap-2 flex-wrap mt-5">
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
                  <span className="text-[10px] text-white/45 uppercase tracking-wide">기본가</span>
                  <span className="text-[12px] font-semibold text-white">{formatWon(vehicle.basePrice)}~</span>
                </div>
                {vehicle.defaultTrim?.engineType && (
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
                    <span className="text-[10px] text-white/45 uppercase tracking-wide">연료</span>
                    <span className="text-[12px] font-semibold text-white">{vehicle.defaultTrim.engineType}</span>
                  </div>
                )}
                {vehicle.defaultTrim?.fuelEfficiency && (
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
                    <span className="text-[10px] text-white/45 uppercase tracking-wide">연비</span>
                    <span className="text-[12px] font-semibold text-white">{vehicle.defaultTrim.fuelEfficiency}km/L~</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-[6px] px-3 py-1.5">
                  <span className="text-[10px] text-white/45 uppercase tracking-wide">트림</span>
                  <span className="text-[12px] font-semibold text-white">{vehicle.trims.length}종</span>
                </div>
              </div>
            </motion.div>

            {/* 월납입 카드 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 }}
              className="shrink-0 bg-white/10 backdrop-blur-md border border-white/15
                         rounded-card p-6 min-w-[240px]"
            >
              <p className="text-[11px] text-white/45 mb-1">표준형 48개월 기준</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMonthly ?? "init"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline gap-1 mb-4"
                >
                  <span className="text-[36px] font-semibold text-white leading-none">
                    {currentMonthly ? formatMonthlyShort(currentMonthly) : "---"}
                  </span>
                  <span className="text-[15px] text-white/55">~</span>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Check size={11} strokeWidth={2.5} />
                개인정보 없이 견적 확인 가능
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────
          MAIN CONTENT
      ────────────────────────────────────────────────── */}
      <div className="page-container py-10">
        <div className="grid grid-cols-3 gap-8">

          {/* ────────────────────────────────────────────
              LEFT: 스펙 + 갤러리 + 트림 + 견적 플로우
          ──────────────────────────────────────────── */}
          <div className="col-span-2 space-y-6">

            {/* ── 이미지 갤러리 ─────────────────────── */}
            {allImages.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="bg-white rounded-card border border-[#F0F0F0] overflow-hidden shadow-card"
              >
                <div className="flex items-center gap-2 px-6 pt-5 pb-4">
                  <Images size={14} className="text-ink-caption" />
                  <h2 className="text-[15px] font-semibold text-ink">차량 이미지</h2>
                  <span className="text-[11px] text-ink-caption ml-auto">
                    {activeImageIdx + 1} / {allImages.length}
                  </span>
                </div>

                {/* 메인 이미지 */}
                <div className="relative aspect-video bg-neutral overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImageIdx}
                      src={allImages[activeImageIdx]}
                      alt={`${vehicle.name} 이미지 ${activeImageIdx + 1}`}
                      className="w-full h-full object-cover"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  </AnimatePresence>
                </div>

                {/* 썸네일 스트립 (2장 이상일 때) */}
                {allImages.length > 1 && (
                  <div className="flex gap-2 px-6 py-4 overflow-x-auto">
                    {allImages.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setActiveImageIdx(i)}
                        className={cn(
                          "shrink-0 w-20 aspect-video rounded-[8px] overflow-hidden border-2 transition-all duration-150",
                          i === activeImageIdx
                            ? "border-primary"
                            : "border-transparent opacity-60 hover:opacity-90",
                        )}
                      >
                        <img
                          src={url}
                          alt={`썸네일 ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {/* ── 트림 선택 (캐스케이딩 드롭다운) ─── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
            >
              <div className="mb-5">
                <h2 className="text-[15px] font-semibold text-ink mb-1">트림 선택</h2>
                <p className="text-[12px] text-ink-caption">
                  트림을 선택하면 해당 조건으로 견적을 바로 확인할 수 있어요
                </p>
              </div>

              <div className="space-y-3">
                {/* 1단계: 라인업 (연식/엔진) */}
                <CascadeSelect
                  label="라인업"
                  value={selectedLineup ?? ""}
                  placeholder="연식 / 엔진을 선택하세요"
                  options={availableLineups.map((l) => ({ value: l, label: l }))}
                  onChange={(v) => {
                    setSelectedLineup(v || null);
                    setSelectedTrimName(null);
                  }}
                />

                {/* 2단계: 트림명 (라인업 선택 후) */}
                {selectedLineup && (
                  <CascadeSelect
                    label="트림"
                    value={selectedTrimName ?? ""}
                    placeholder="트림을 선택하세요"
                    options={availableTrimNames.map((t) => ({
                      value: t.name,
                      label: `${t.name} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                    }))}
                    onChange={(v) => {
                      if (v) handleTrimNameSelect(v);
                      else setSelectedTrimName(null);
                    }}
                  />
                )}

                {/* 선택된 트림 상세 (옵션 + 견적 CTA) */}
                {selectedTrim && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* 트림 가격 요약 */}
                    <div className="flex items-center justify-between px-4 py-3 bg-primary-100 rounded-[10px] border border-primary-200 mb-3">
                      <div>
                        <p className="text-[13px] font-semibold text-primary">
                          {(selectedTrim.specs as Record<string, string>)?.trimName ?? selectedTrim.name}
                        </p>
                        <p className="text-[11px] text-ink-caption mt-0.5">
                          {selectedTrim.engineType}
                          {selectedTrim.fuelEfficiency ? ` · 연비 ${selectedTrim.fuelEfficiency}km/L` : ""}
                        </p>
                      </div>
                      <span className="text-[16px] font-bold text-primary">
                        {formatWon(selectedTrim.price)}
                      </span>
                    </div>

                    {/* 옵션 목록 */}
                    {selectedTrim.options.length > 0 && (() => {
                      const optsByCategory = groupOptions(selectedTrim.options);
                      return (
                        <div className="border border-[#F0F0F0] rounded-[10px] px-4 pt-3 pb-4 mb-3">
                          <p className="text-[10px] font-semibold text-ink-caption uppercase tracking-wider mb-3">
                            포함 옵션
                          </p>
                          <div className="space-y-4">
                            {Object.entries(optsByCategory).map(([cat, opts]) => (
                              <div key={cat}>
                                <p className="text-[11px] font-semibold text-ink mb-2">{cat}</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                  {opts.map((opt) => (
                                    <div key={opt.id} className="flex items-start gap-1.5 text-[12px] text-ink-label">
                                      <span className={cn(
                                        "w-1.5 h-1.5 rounded-full shrink-0 mt-[4px]",
                                        opt.isDefault ? "bg-primary" : "bg-neutral-300"
                                      )} />
                                      <span className="leading-tight">
                                        {opt.name}
                                        {opt.price > 0 && (
                                          <span className="text-ink-caption ml-1">+{formatWon(opt.price)}</span>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 견적 CTA */}
                    {!quoteVisible && (
                      <button
                        type="button"
                        onClick={() => handleTrimSelect(selectedTrim)}
                        className="w-full py-2.5 rounded-btn bg-primary text-white text-[13px] font-semibold
                                   hover:bg-primary/90 transition-colors duration-150 flex items-center justify-center gap-2"
                      >
                        이 트림으로 견적 시작하기
                        <ArrowRight size={13} strokeWidth={2.5} />
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.section>

            {/* ── 선택 트림 상세 스펙 ──────────────── */}
            <AnimatePresence>
              {selectedTrim && (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-semibold text-ink">선택 트림 스펙</h2>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={selectedTrimId}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2 }}
                        className="text-[12px] font-medium text-primary bg-primary-100 px-2.5 py-1 rounded-pill"
                      >
                        {(selectedTrim.specs as Record<string, string>)?.trimName ?? selectedTrim.name}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedTrimId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* 고정 스펙: 연료·연비·출고가 */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <SpecCard label="연료 타입" value={selectedTrim.engineType ?? "-"} />
                        <SpecCard
                          label="연비"
                          value={
                            selectedTrim.fuelEfficiency
                              ? `${selectedTrim.fuelEfficiency}km/L`
                              : "-"
                          }
                        />
                        <SpecCard
                          label="출고가"
                          value={formatWon(selectedTrim.price)}
                          highlight
                        />
                      </div>

                      {/* 동적 스펙: specs JSON (내부 필드 제외) */}
                      {(() => {
                        const displaySpecs = Object.entries(selectedTrim.specs ?? {}).filter(
                          ([k]) => !["model", "lineup", "trimName"].includes(k)
                        );
                        return displaySpecs.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {displaySpecs.map(([label, value]) => (
                              <SpecCard key={label} label={label} value={String(value)} />
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </motion.div>
                  </AnimatePresence>
                </motion.section>
              )}
            </AnimatePresence>

            {/* ── 견적 플로우 스크롤 앵커 ─────────── */}
            <div ref={quoteAnchorRef} className="-mt-2" />

            {/* ── 견적 플로우 (트림 클릭 후 reveal) ─ */}
            <AnimatePresence>
              {quoteVisible && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="space-y-6"
                >
                  {/* STEP 1: 견적 조건 설정 */}
                  <section className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card">
                    <div className="flex items-center gap-2.5 mb-5">
                      <StepBadge n={1} />
                      <h2 className="text-[15px] font-semibold text-ink">
                        견적 조건 설정
                      </h2>
                    </div>
                    <div className="space-y-5">
                      {/* 계약기간 */}
                      <div>
                        <p className="text-[11px] font-medium text-ink-caption uppercase tracking-wider mb-2.5">
                          계약기간
                        </p>
                        <div className="flex gap-2">
                          {CONTRACT_MONTHS.map((m) => (
                            <button
                              key={m}
                              onClick={() => handleMonthsChange(m)}
                              className={cn(
                                "flex-1 py-2 rounded-btn text-[13px] font-medium border transition-all duration-150",
                                contractMonths === m
                                  ? "bg-primary text-white border-primary"
                                  : "bg-white text-ink-label border-neutral-800 hover:border-primary/40",
                              )}
                            >
                              {m}개월
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 연간 약정거리 */}
                      <div>
                        <p className="text-[11px] font-medium text-ink-caption uppercase tracking-wider mb-2.5">
                          연간 약정거리
                        </p>
                        <div className="flex gap-2">
                          {ANNUAL_MILEAGES.map((km) => (
                            <button
                              key={km}
                              onClick={() => handleMileageChange(km)}
                              className={cn(
                                "flex-1 py-2 rounded-btn text-[13px] font-medium border transition-all duration-150",
                                annualMileage === km
                                  ? "bg-primary text-white border-primary"
                                  : "bg-white text-ink-label border-neutral-800 hover:border-primary/40",
                              )}
                            >
                              연 {km / 10_000}만km
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 계약 유형 */}
                      <div>
                        <p className="text-[11px] font-medium text-ink-caption uppercase tracking-wider mb-2.5">
                          계약 유형
                        </p>
                        <div className="flex gap-2">
                          {(["반납형", "인수형"] as ContractType[]).map(
                            (type) => (
                              <button
                                key={type}
                                onClick={() => handleTypeChange(type)}
                                className={cn(
                                  "flex-1 py-2 rounded-btn text-[13px] font-medium border transition-all duration-150",
                                  contractType === type
                                    ? "bg-primary text-white border-primary"
                                    : "bg-white text-ink-label border-neutral-800 hover:border-primary/40",
                                )}
                              >
                                {type}
                              </button>
                            ),
                          )}
                        </div>
                        <p className="text-[11px] text-ink-caption mt-2">
                          {contractType === "반납형"
                            ? "계약 종료 후 반납 · 전액 비용처리 가능"
                            : "계약 종료 후 잔존가치로 차량 매입 · 감가상각 가능"}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* STEP 2: 견적 시나리오 */}
                  <section className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card">
                    <div className="flex items-center gap-2.5 mb-5">
                      <StepBadge n={2} />
                      <h2 className="text-[15px] font-semibold text-ink">
                        견적 시나리오
                      </h2>
                      <span className="text-[11px] text-ink-caption ml-auto">
                        {contractMonths}개월 · 연{annualMileage / 10_000}만km · {contractType}
                      </span>
                    </div>

                    {isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="h-16 rounded-[10px] bg-neutral animate-pulse"
                          />
                        ))}
                      </div>
                    ) : detailedScenarios ? (
                      <QuoteBreakdownTabs scenarios={detailedScenarios} />
                    ) : (
                      <p className="text-[13px] text-ink-label py-8 text-center">
                        견적 데이터를 준비 중입니다
                      </p>
                    )}
                  </section>

                  {/* STEP 3: 가격 구성 원리 */}
                  <section className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card">
                    <div className="flex items-center gap-2.5 mb-5">
                      <StepBadge n={3} />
                      <h2 className="text-[15px] font-semibold text-ink">
                        이 견적이 나온 이유
                      </h2>
                      <span className="text-[11px] bg-primary-100 text-primary px-2 py-0.5 rounded-pill ml-auto">
                        투명공개
                      </span>
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          step: "01",
                          label: "차량 기준가",
                          value: formatWon(
                            selectedTrim?.price ?? vehicle.basePrice,
                          ),
                          desc: "선택한 트림 출고가 기준",
                        },
                        {
                          step: "02",
                          label: "회수율 적용",
                          value: "금융사 조건 기준",
                          desc: "차량가격·기간·거리별 선형보간 계산",
                        },
                        {
                          step: "03",
                          label: "계약조건 반영",
                          value: `${contractMonths}개월 / 연${annualMileage / 10_000}만km`,
                          desc: "기간·거리별 회수율 조정",
                        },
                        {
                          step: "04",
                          label: "가산율 적용",
                          value: "순위 + 차량 + 금융사",
                          desc: "투명하게 공개된 가산 항목별 금액 포함",
                        },
                        {
                          step: "05",
                          label: "표준형 월납입",
                          value: detailedScenarios
                            ? formatWon(
                                detailedScenarios.standard.monthlyPayment,
                              )
                            : "---",
                          desc: "보증금·선납금 0% 기준 최종 납입금",
                          highlight: true,
                        },
                      ].map((row) => (
                        <div
                          key={row.step}
                          className={cn(
                            "flex items-center gap-4 p-3.5 rounded-[10px]",
                            row.highlight
                              ? "bg-primary-100 border border-primary-200"
                              : "bg-neutral",
                          )}
                        >
                          <span className="text-[11px] font-semibold text-ink-caption w-6 shrink-0">
                            {row.step}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-[13px] font-medium",
                                row.highlight ? "text-primary" : "text-ink",
                              )}
                            >
                              {row.label}
                            </p>
                            <p className="text-[11px] text-ink-caption">
                              {row.desc}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-[14px] font-semibold shrink-0",
                              row.highlight ? "text-primary" : "text-ink",
                            )}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-[11px] text-ink-caption mt-4 flex items-start gap-1.5">
                      <Info size={11} className="shrink-0 mt-0.5" />
                      실제 견적은 금융사·취급점 조건에 따라 달라질 수 있습니다.
                      상담을 통해 최종 조건을 확정해드립니다.
                    </p>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ────────────────────────────────────────────
              RIGHT: 스티키 사이드바 (기존 유지)
          ──────────────────────────────────────────── */}
          <div className="col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* 월납입 + 상담 버튼 */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.25 }}
                className="bg-white rounded-card border border-[#F0F0F0] p-5 shadow-card"
              >
                <div className="mb-1">
                  <p className="text-[11px] text-ink-caption">표준형 월납입</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentMonthly ?? "loading"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="text-[28px] font-semibold text-ink leading-tight"
                    >
                      {currentMonthly ? formatWon(currentMonthly) : "---"}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-[11px] text-ink-caption mt-0.5">
                    {contractMonths}개월 · 연{annualMileage / 10_000}만km ·{" "}
                    {contractType}
                  </p>
                </div>
                <div className="h-px bg-[#F0F0F0] my-4" />
                <ChannelTalkButton vehicleName={vehicle.name} size="md" />
                <p className="text-[11px] text-ink-caption text-center mt-3">
                  상담 전 이름·전화번호 요구 없음
                </p>
              </motion.div>

              {/* AI 인사이트 */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.32 }}
              >
                <AiInsight
                  reason={aiReason}
                  highlights={vehicle.highlights}
                />
              </motion.div>

              {/* 아임딜러 약속 */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.39 }}
                className="bg-white rounded-card border border-[#F0F0F0] p-4 shadow-card"
              >
                <p className="text-[11px] font-semibold text-ink-caption uppercase tracking-wider mb-3">
                  아임딜러 약속
                </p>
                <ul className="space-y-2">
                  {TRUST_ITEMS.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-[12px] text-ink-label"
                    >
                      <span className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <Check
                          size={9}
                          strokeWidth={2.5}
                          className="text-primary"
                        />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* 다른 차량 탐색 */}
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.44 }}
              >
                <Link
                  href="/cars"
                  className="flex items-center justify-between w-full text-[13px] text-ink-label
                             hover:text-ink transition-colors duration-150 group"
                >
                  <span>다른 차량 탐색하기</span>
                  <ChevronRight
                    size={14}
                    className="group-hover:translate-x-0.5 transition-transform duration-150"
                  />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── AI 추천 배너 ──────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-12 rounded-card overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
          }}
        >
          <div className="px-12 py-10 flex items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-white/60" />
                <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                  AI 추천
                </span>
              </div>
              <h3 className="font-display text-[22px] font-light text-white mb-1.5">
                나에게 맞는 차량이 따로 있을 수 있어요
              </h3>
              <p className="text-[13px] text-white/60">
                업종·목적·예산·성향 4가지로 최적 차량을 찾아드려요
              </p>
            </div>
            <Link
              href="/recommend"
              className="shrink-0 inline-flex items-center gap-2 bg-white text-primary
                         text-[13px] font-semibold px-6 py-3 rounded-btn
                         hover:bg-primary-100 transition-colors duration-200"
            >
              AI 추천 시작
              <ArrowRight size={14} strokeWidth={2.5} />
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

// ── 서브 컴포넌트 ──────────────────────────────────────────

function SpecCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] p-3.5",
        highlight ? "bg-primary-100 border border-primary-200" : "bg-neutral",
      )}
    >
      <p
        className={cn(
          "text-[10px] uppercase tracking-wider mb-1",
          highlight ? "text-primary/60" : "text-ink-caption",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "text-[14px] font-semibold",
          highlight ? "text-primary" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}
