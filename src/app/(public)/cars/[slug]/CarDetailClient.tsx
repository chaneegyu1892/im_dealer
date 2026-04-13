"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Check,
  ChevronRight,
  Images,
  Fuel,
  Gauge,
  Tag,
  Calculator,
  Building2,
  Leaf,
  TrendingDown,
  MapPin,
  Users,
  Receipt,
  ShieldCheck,
  Wrench,
  BadgePercent,
  RefreshCw,
  UserX,
  BatteryCharging,
  Zap,
  Settings2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AiInsight } from "@/components/quote/AiInsight";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import type { VehicleDetail } from "@/types/api";
import type { EngineType } from "@/types/vehicle";
import type { RecommendScenarios } from "@/types/recommendation";

// ── 상수 ───────────────────────────────────────────────────
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

// ── 유틸 ───────────────────────────────────────────────────
function formatWon(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}천만원`;
  if (n >= 10_000) return `${Math.round(n / 10_000)}만원`;
  return `${n.toLocaleString("ko-KR")}원`;
}
function formatMonthlyShort(n: number) {
  return `${Math.round(n / 10_000)}만원`;
}

// ── 스펙 카드 ──────────────────────────────────────────────
function SpecCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] p-3.5",
        highlight
          ? "bg-primary-100 border border-primary-200"
          : "bg-neutral border border-[#EBEBEB]",
      )}
    >
      <p className="text-[10px] font-medium text-ink-caption uppercase tracking-wider mb-1">
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

// ══════════════════════════════════════════════════════════
// CarDetailClient
// ══════════════════════════════════════════════════════════
export function CarDetailClient({ vehicle }: { vehicle: VehicleDetail }) {
  // 사이드바용 초기 시나리오 (서버에서 받은 간단 버전)
  const [simpleScenarios] = useState<RecommendScenarios | null>(vehicle.scenarios);

  // 이미지 갤러리 선택
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const engineType = (vehicle.defaultTrim?.engineType ?? "가솔린") as EngineType;

  // ── 현재 월납입 (사이드바 표시용) ────────────────────────
  const currentMonthly = simpleScenarios?.standard?.monthlyPayment;

  const aiReason =
    vehicle.aiCaption ?? `${vehicle.name}은(는) 이 조건에 적합한 차량입니다.`;

  // 갤러리 이미지 목록
  const allImages = vehicle.imageUrls.length > 0
    ? vehicle.imageUrls
    : vehicle.thumbnailUrl
    ? [vehicle.thumbnailUrl]
    : [];
  const heroImage = vehicle.thumbnailUrl || allImages[0] || "";

  // ── 추천 대상 태그 (highlights 기반 + 차종/연료 보정) ───
  const KEYWORD_ICON_MAP: { keywords: string[]; icon: React.ReactNode; label: string }[] = [
    { keywords: ["법인", "비용처리", "경비"],       icon: <Building2 size={13} />,    label: "법인·사업자" },
    { keywords: ["친환경", "전기", "EV", "ev"],     icon: <Leaf size={13} />,          label: "친환경 선호" },
    { keywords: ["연비", "유지비", "절감"],          icon: <TrendingDown size={13} />,  label: "유지비 절감" },
    { keywords: ["출퇴근", "통근", "업무"],          icon: <MapPin size={13} />,        label: "출퇴근·업무용" },
    { keywords: ["가족", "넓", "공간"],              icon: <Users size={13} />,          label: "가족 동반" },
    { keywords: ["절세", "세제", "혜택"],            icon: <Receipt size={13} />,       label: "절세 혜택" },
  ];

  const derivedTags: { icon: React.ReactNode; label: string }[] = [];
  const joined = vehicle.highlights.join(" ");
  for (const { keywords, icon, label } of KEYWORD_ICON_MAP) {
    if (keywords.some((kw) => joined.includes(kw))) {
      derivedTags.push({ icon, label });
    }
  }
  // 매칭 태그가 부족하면 차종·연료로 보충
  if (derivedTags.length < 3) {
    if (engineType === "EV" && !derivedTags.find((t) => t.label === "친환경 선호")) {
      derivedTags.push({ icon: <Leaf size={13} />, label: "친환경 선호" });
    }
    if ((vehicle.category === "세단" || vehicle.category === "SUV") && !derivedTags.find((t) => t.label === "출퇴근·업무용")) {
      derivedTags.push({ icon: <MapPin size={13} />, label: "출퇴근·업무용" });
    }
    if (!derivedTags.find((t) => t.label === "법인·사업자")) {
      derivedTags.push({ icon: <Building2 size={13} />, label: "법인·사업자" });
    }
  }

  // ── Key Figures 동적 구성 ────────────────────────────────
  const defaultSpecs = (vehicle.defaultTrim?.specs ?? {}) as Record<string, string>;
  const isEV = engineType === "EV";

  // 연비: defaultTrim → 다른 트림 fallback
  const anyFuelEff =
    vehicle.defaultTrim?.fuelEfficiency ??
    vehicle.trims.find((t) => t.fuelEfficiency != null)?.fuelEfficiency ??
    null;

  type KeyFigure = { label: string; value: string; icon: React.ReactNode; highlight?: boolean };

  const keyFigures: KeyFigure[] = [
    // 1) 연료 타입 (항상)
    {
      label: "연료",
      value: ENGINE_LABEL[engineType],
      icon: <Fuel size={16} />,
    },
    // 2) 연비 or EV 1회충전 주행거리
    isEV && defaultSpecs.range
      ? { label: "1회 충전", value: defaultSpecs.range, icon: <BatteryCharging size={16} /> }
      : {
          label: "연비 (기본형)",
          value: anyFuelEff ? `${anyFuelEff}km/L` : "-",
          icon: <Gauge size={16} />,
        },
    // 3) 엔진 or EV 충전방식
    isEV && defaultSpecs.charge
      ? { label: "충전방식", value: defaultSpecs.charge, icon: <Zap size={16} /> }
      : defaultSpecs.engine
      ? { label: "엔진", value: defaultSpecs.engine, icon: <Settings2 size={16} /> }
      : { label: "기본가", value: `${formatWon(vehicle.basePrice)}~`, icon: <Tag size={16} />, highlight: true },
    // 4) 최고출력 > 적재량 > 승차인원 > 기본가
    defaultSpecs.power
      ? { label: "최고출력", value: defaultSpecs.power, icon: <Zap size={16} />, highlight: true }
      : defaultSpecs.payload
      ? { label: "최대적재량", value: defaultSpecs.payload, icon: <Package size={16} /> }
      : defaultSpecs.seat
      ? { label: "승차인원", value: defaultSpecs.seat, icon: <Users size={16} /> }
      : { label: "기본가", value: `${formatWon(vehicle.basePrice)}~`, icon: <Tag size={16} />, highlight: true },
  ];

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
              LEFT: 이미지 갤러리 + 차량 스펙 정보
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

            {/* ── Key Figures ───────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-white rounded-card border border-[#F0F0F0] p-6 shadow-card"
            >
              <div className="flex items-center gap-2 mb-5">
                <Gauge size={14} className="text-primary" />
                <p className="text-[11px] font-semibold text-ink-caption uppercase tracking-wider">핵심 제원</p>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {keyFigures.map(({ label, value, icon, highlight }) => (
                  <div
                    key={label}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-[12px] border",
                      highlight
                        ? "bg-primary/5 border-primary/20"
                        : "bg-neutral border-[#EBEBEB]"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center",
                      highlight ? "bg-primary/15" : "bg-primary/10"
                    )}>
                      <span className="text-primary">{icon}</span>
                    </div>
                    <p className={cn(
                      "text-[10px] text-center",
                      highlight ? "text-primary/70" : "text-ink-caption"
                    )}>
                      {label}
                    </p>
                    <p className={cn(
                      "text-[13px] font-semibold text-center leading-tight",
                      highlight ? "text-primary" : "text-ink"
                    )}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.section>

            {/* ── 이런 분께 추천드려요 ─────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.35 }}
              className="bg-white rounded-card border border-[#F0F0F0] overflow-hidden shadow-card"
            >
              {/* 헤더 바 */}
              <div className="flex items-center gap-2.5 px-6 py-4 border-b border-[#F4F4F4] bg-neutral">
                <Users size={14} className="text-primary" />
                <p className="text-[12px] font-semibold text-ink">이런 분께 추천드려요</p>
              </div>

              <div className="px-6 py-5">
                {/* 추천 태그 */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {derivedTags.map(({ icon, label }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5
                                 bg-primary/6 border border-primary/15 rounded-full
                                 text-[12px] font-medium text-primary"
                    >
                      {icon}
                      {label}
                    </span>
                  ))}
                </div>

                {/* highlights 포인트 */}
                {vehicle.highlights.length > 0 && (
                  <div className="grid grid-cols-2 gap-2.5">
                    {vehicle.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 p-3 rounded-[10px] bg-neutral border border-[#EBEBEB]"
                      >
                        <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={8} strokeWidth={3} className="text-white" />
                        </span>
                        <p className="text-[12px] text-ink-label leading-snug">{h}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>

            {/* ── 장기렌트 핵심 혜택 ───────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="rounded-card overflow-hidden shadow-card"
              style={{
                background: "linear-gradient(135deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
              }}
            >
              <div className="px-7 pt-6 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck size={14} className="text-white/55" />
                  <p className="text-[11px] font-semibold text-white/55 uppercase tracking-wider">
                    장기렌트 핵심 혜택
                  </p>
                </div>
                <p className="text-[18px] font-light text-white mb-5">
                  이 차를 렌트로 타면 달라지는 것들
                </p>
              </div>

              <div className="grid grid-cols-3 gap-px bg-white/10 border-t border-white/10">
                {[
                  {
                    icon: <Receipt size={16} />,
                    title: "전액 비용처리",
                    desc: "렌트료 100% 경비 처리\n(법인·개인사업자)",
                  },
                  {
                    icon: <Wrench size={16} />,
                    title: "유지보수 포함",
                    desc: "정기점검·소모품\n비용 걱정 없음",
                  },
                  {
                    icon: <BadgePercent size={16} />,
                    title: "보험료 절감",
                    desc: "자동차 보험이\n렌트료에 포함",
                  },
                  {
                    icon: <TrendingDown size={16} />,
                    title: "초기비용 최소",
                    desc: "보증금 0%부터\n시작 가능",
                  },
                  {
                    icon: <RefreshCw size={16} />,
                    title: "잔존가치 부담 없음",
                    desc: "계약 종료 후 반납,\n시세 하락 위험 없음",
                  },
                  {
                    icon: <UserX size={16} />,
                    title: "개인정보 없이",
                    desc: "이름·전화번호 요구\n없이 견적 확인",
                  },
                ].map(({ icon, title, desc }) => (
                  <div
                    key={title}
                    className="flex flex-col gap-2 px-5 py-5 bg-white/5 hover:bg-white/10 transition-colors duration-150"
                  >
                    <span className="text-white/50">{icon}</span>
                    <p className="text-[13px] font-semibold text-white leading-snug">{title}</p>
                    <p className="text-[11px] text-white/50 leading-relaxed whitespace-pre-line">{desc}</p>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>

          {/* ────────────────────────────────────────────
              RIGHT: 스티키 사이드바
          ──────────────────────────────────────────── */}
          <div className="col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* 월납입 + 견적내기 + 상담 버튼 */}
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
                      {currentMonthly ? formatMonthlyShort(currentMonthly) : "---"}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-[11px] text-ink-caption mt-0.5">
                    48개월 · 연2만km · 반납형 기준
                  </p>
                </div>
                <div className="h-px bg-[#F0F0F0] my-4" />

                {/* 견적내기 버튼 */}
                <Link
                  href={`/quote?vehicle=${vehicle.slug}`}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-btn
                             bg-primary text-white text-[14px] font-semibold
                             hover:bg-primary/90 active:scale-[0.98]
                             transition-all duration-150 mb-2.5"
                >
                  <Calculator size={15} strokeWidth={2} />
                  견적내기
                </Link>

                {/* 상담하기 */}
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
              href="/"
              className="shrink-0 flex items-center gap-2 px-6 py-3 rounded-btn
                         bg-white text-primary text-[13px] font-semibold
                         hover:bg-white/90 transition-colors duration-150"
            >
              AI 추천 받기
              <ChevronRight size={13} strokeWidth={2.5} />
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
