"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Info,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuoteScenarioTabs } from "@/components/quote/QuoteScenarioTabs";
import { AiInsight } from "@/components/quote/AiInsight";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import type { VehicleDetail, QuoteResponse } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import type { RecommendScenarios } from "@/types/recommendation";

const CONTRACT_MONTHS = [36, 48, 60] as const;
const ANNUAL_MILEAGES = [10_000, 20_000, 30_000] as const;
type ContractMonths = (typeof CONTRACT_MONTHS)[number];
type AnnualMileage = (typeof ANNUAL_MILEAGES)[number];
type ContractType = "반납형" | "인수형";

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
  기아: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
};

function formatWon(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}천만원`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatMonthlyShort(n: number) {
  return `${Math.round(n / 10_000)}만원`;
}

const ENGINE_LABEL: Record<EngineType, { text: string; className: string }> = {
  EV: { text: "전기차", className: "bg-primary-100 text-primary" },
  하이브리드: { text: "하이브리드", className: "bg-green-50 text-green-700" },
  가솔린: { text: "가솔린", className: "bg-neutral text-ink-label" },
  디젤: { text: "디젤", className: "bg-amber-50 text-amber-700" },
};

const TRUST_ITEMS = [
  "허위·낚시 견적 없음",
  "개인정보 없이 견적 확인",
  "상담 압박 없음",
  "실제 운영 가능한 조건만",
];

export function CarDetailClient({ vehicle }: { vehicle: VehicleDetail }) {
  const [contractMonths, setContractMonths] = useState<ContractMonths>(48);
  const [annualMileage, setAnnualMileage] = useState<AnnualMileage>(20_000);
  const [contractType, setContractType] = useState<ContractType>("반납형");
  const [scenarios, setScenarios] = useState<RecommendScenarios | null>(
    vehicle.scenarios
  );
  const [isLoading, setIsLoading] = useState(false);

  const brandColor = BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"];
  const engineType = (vehicle.defaultTrim?.engineType ?? "가솔린") as EngineType;
  const engineLabel = ENGINE_LABEL[engineType];
  const specs = vehicle.defaultTrim?.specs ?? {};

  const fetchQuote = useCallback(
    async (months: number, mileage: number, type: string) => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/vehicles/${vehicle.slug}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contractMonths: months,
            annualMileage: mileage,
            contractType: type,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data as QuoteResponse;
          setScenarios(data.scenarios);
        }
      } catch {
        // 에러 시 기존 scenarios 유지
      } finally {
        setIsLoading(false);
      }
    },
    [vehicle.slug]
  );

  const handleMonthsChange = (m: ContractMonths) => {
    setContractMonths(m);
    fetchQuote(m, annualMileage, contractType);
  };
  const handleMileageChange = (km: AnnualMileage) => {
    setAnnualMileage(km);
    fetchQuote(contractMonths, km, contractType);
  };
  const handleTypeChange = (type: ContractType) => {
    setContractType(type);
    fetchQuote(contractMonths, annualMileage, type);
  };

  const stdMonthly = scenarios
    ? formatMonthlyShort(scenarios.standard.monthlyPayment)
    : "---";

  const aiReason = vehicle.aiCaption
    ?? `${vehicle.name}은(는) 이 조건에 적합한 차량입니다.`;

  return (
    <div className="min-h-screen bg-neutral">
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: brandColor }}>
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -left-12 bottom-0 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/25 pointer-events-none" />

        <div className="relative z-10 page-container pt-6 pb-10">
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Link
              href="/cars"
              className="inline-flex items-center gap-1.5 text-white/60 hover:text-white/90
                         text-[12px] font-medium transition-colors duration-150 mb-8 group"
            >
              <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform duration-150" />
              차량 목록
            </Link>
          </motion.div>

          <div className="flex items-end justify-between gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="flex-1"
            >
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.18em]">
                  {vehicle.brand}
                </span>
                <span className="text-white/30">·</span>
                <span className="text-[11px] text-white/50">{vehicle.category}</span>
                <span className={cn(
                  "text-[10px] font-semibold px-2 py-0.5 rounded-[4px] ml-1",
                  engineType === "EV" ? "bg-white/15 text-white/80" : "bg-white/10 text-white/70"
                )}>
                  {engineLabel.text}
                </span>
                {vehicle.isPopular && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 text-white/80 px-2 py-0.5 rounded-[4px]">
                    <Sparkles size={9} /> 인기
                  </span>
                )}
              </div>

              <h1 className="font-display text-[52px] font-light text-white leading-none tracking-tight mb-3">
                {vehicle.name}
              </h1>
              <p className="text-white/55 text-[14px] leading-relaxed max-w-md mb-6">
                {vehicle.description}
              </p>

              <div className="flex flex-wrap gap-6">
                {Object.entries(specs).slice(0, 4).map(([label, value]) => (
                  <div key={label}>
                    <div className="text-[10px] text-white/35 mb-0.5 uppercase tracking-wider">{label}</div>
                    <div className="text-[14px] font-medium text-white/85">{value}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="shrink-0 bg-white/10 backdrop-blur-sm border border-white/15 rounded-card p-6 min-w-[240px]"
            >
              <p className="text-[11px] text-white/45 mb-1">표준형 48개월 기준</p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={stdMonthly}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline gap-1 mb-4"
                >
                  <span className="text-[36px] font-semibold text-white leading-none">{stdMonthly}</span>
                  <span className="text-[15px] text-white/60">~</span>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center gap-1.5 text-[11px] text-white/45">
                <Check size={11} strokeWidth={2.5} /> 개인정보 없이 ��적 확인 가능
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 메인 콘텐츠 */}
      <div className="page-container py-10">
        <div className="grid grid-cols-3 gap-8">
          {/* 좌: 견적 시뮬레이터 */}
          <div className="col-span-2 space-y-6">
            {/* 견적 조건 설정 */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
            >
              <h2 className="text-[15px] font-semibold text-ink mb-5">견적 조건 설정</h2>
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] font-medium text-ink-caption uppercase tracking-wider mb-2.5">계약기간</p>
                  <div className="flex gap-2">
                    {CONTRACT_MONTHS.map((m) => (
                      <button
                        key={m}
                        onClick={() => handleMonthsChange(m)}
                        className={cn(
                          "flex-1 py-2 rounded-btn text-[13px] font-medium border transition-all duration-150",
                          contractMonths === m
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-ink-label border-neutral-800 hover:border-primary-400 hover:text-ink"
                        )}
                      >
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-ink-caption uppercase tracking-wider mb-2.5">연간 약정거리</p>
                  <div className="flex gap-2">
                    {ANNUAL_MILEAGES.map((km) => (
                      <button
                        key={km}
                        onClick={() => handleMileageChange(km)}
                        className={cn(
                          "flex-1 py-2 rounded-btn text-[13px] font-medium border transition-all duration-150",
                          annualMileage === km
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-ink-label border-neutral-800 hover:border-primary-400 hover:text-ink"
                        )}
                      >
                        연 {km / 10_000}만km
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-medium text-ink-caption uppercase tracking-wider mb-2.5">계약 유형</p>
                  <div className="flex gap-2">
                    {(["반납형", "인수형"] as ContractType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleTypeChange(type)}
                        className={cn(
                          "flex-1 py-2 rounded-btn text-[13px] font-medium border transition-all duration-150",
                          contractType === type
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-ink-label border-neutral-800 hover:border-primary-400 hover:text-ink"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-ink-caption mt-2">
                    {contractType === "반납형"
                      ? "계약 종료 후 반납 · 전액 비용처리 가능"
                      : "계약 종료 후 잔존가치로 차량 매입 · 감가상각 가능"}
                  </p>
                </div>
              </div>
            </motion.section>

            {/* 견적 시나리오 */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.28 }}
              className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-semibold text-ink">견적 시나리오</h2>
                <span className="text-[11px] text-ink-caption">
                  {contractMonths}개월 · 연{annualMileage / 10_000}만km · {contractType}
                </span>
              </div>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-btn bg-neutral animate-pulse" />
                  ))}
                </div>
              ) : scenarios ? (
                <QuoteScenarioTabs scenarios={scenarios} />
              ) : (
                <p className="text-[13px] text-ink-label py-8 text-center">
                  견적 데이터를 준비 중입니다
                </p>
              )}
            </motion.section>

            {/* 가격 투명성 */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.34 }}
              className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
            >
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-[15px] font-semibold text-ink">가격 구성 원리</h2>
                <span className="text-[11px] bg-primary-100 text-primary px-2 py-0.5 rounded-pill">투명공개</span>
              </div>
              <div className="space-y-3">
                {[
                  { step: "01", label: "차량 기준가", value: formatWon(vehicle.defaultTrim?.price ?? vehicle.basePrice), desc: "출고가 기준" },
                  { step: "02", label: "회수율 적용", value: "금융사 조건 기준", desc: "차량가격·기간·거리별 선형보간" },
                  { step: "03", label: "계약조건 반영", value: `${contractMonths}개월 / 연${annualMileage / 10_000}만km`, desc: "기간·거리별 회수율 ��정" },
                  { step: "04", label: "표준형 월납입", value: scenarios ? formatWon(scenarios.standard.monthlyPayment) : "---", desc: "보증금·선납금 0% 기준", highlight: true },
                ].map((row) => (
                  <div
                    key={row.step}
                    className={cn(
                      "flex items-center gap-4 p-3.5 rounded-btn",
                      row.highlight ? "bg-primary-100 border border-primary-200" : "bg-neutral"
                    )}
                  >
                    <span className="text-[11px] font-semibold text-ink-caption w-6 shrink-0">{row.step}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-[13px] font-medium", row.highlight ? "text-primary" : "text-ink")}>{row.label}</p>
                      <p className="text-[11px] text-ink-caption">{row.desc}</p>
                    </div>
                    <span className={cn("text-[14px] font-semibold shrink-0", row.highlight ? "text-primary" : "text-ink")}>{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-caption mt-4 flex items-start gap-1.5">
                <Info size={11} className="shrink-0 mt-0.5" />
                실제 견적은 금융사·취급점 조건에 따라 달라질 수 있습니다. 상담을 통해 최종 조건을 확정해드립니다.
              </p>
            </motion.section>

            {/* 트림 목록 */}
            {vehicle.trims.length > 1 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
              >
                <h2 className="text-[15px] font-semibold text-ink mb-5">트림 선택</h2>
                <div className="space-y-2">
                  {vehicle.trims.map((trim) => (
                    <div
                      key={trim.id}
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-btn border transition-colors",
                        trim.isDefault
                          ? "border-primary-200 bg-primary-100"
                          : "border-[#F0F0F0] bg-neutral"
                      )}
                    >
                      <div>
                        <p className={cn("text-[13px] font-medium", trim.isDefault ? "text-primary" : "text-ink")}>
                          {trim.name}
                          {trim.isDefault && (
                            <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-primary text-white">기본</span>
                          )}
                        </p>
                        <p className="text-[11px] text-ink-caption">
                          {trim.engineType} {trim.fuelEfficiency ? `· ${trim.fuelEfficiency}km/L` : ""}
                        </p>
                      </div>
                      <span className={cn("text-[14px] font-semibold", trim.isDefault ? "text-primary" : "text-ink")}>
                        {formatWon(trim.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          {/* 우: 스티키 사이드바 */}
          <div className="col-span-1">
            <div className="sticky top-24 space-y-4">
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
                      key={scenarios?.standard.monthlyPayment ?? "loading"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                      className="text-[28px] font-semibold text-ink leading-tight"
                    >
                      {scenarios ? formatWon(scenarios.standard.monthlyPayment) : "---"}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-[11px] text-ink-caption mt-0.5">
                    {contractMonths}개�� · 연{annualMileage / 10_000}만km · {contractType}
                  </p>
                </div>
                <div className="h-px bg-[#F0F0F0] my-4" />
                <ChannelTalkButton vehicleName={vehicle.name} size="md" />
                <p className="text-[11px] text-ink-caption text-center mt-3">
                  상담 전 이름·전화번호 요구 없음
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.32 }}
              >
                <AiInsight reason={aiReason} highlights={vehicle.highlights} />
              </motion.div>

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
                    <li key={item} className="flex items-center gap-2 text-[12px] text-ink-label">
                      <span className="w-4 h-4 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <Check size={9} strokeWidth={2.5} className="text-primary" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

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
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform duration-150" />
                </Link>
              </motion.div>
            </div>
          </div>
        </div>

        {/* 하단 AI 추천 배너 */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-12 rounded-card overflow-hidden"
          style={{ background: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)" }}
        >
          <div className="px-12 py-10 flex items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-white/60" />
                <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">AI 추천</span>
              </div>
              <h3 className="font-display text-[22px] font-light text-white mb-1.5">
                나에게 맞는 차량이 따로 있을 수 있어요
              </h3>
              <p className="text-[13px] text-white/60">
                업종·목적·예산·성향 4가지로 최적 ��량을 찾아드려요
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
