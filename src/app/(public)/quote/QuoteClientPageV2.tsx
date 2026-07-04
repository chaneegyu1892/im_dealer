"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  ChevronLeft,
  BriefcaseBusiness,
  Building2,
  User,
  Check,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TossPrice } from "@/components/ui/TossPrice";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  isCustomerType,
} from "@/constants/customer-types";
import type { VehicleListItem } from "@/types/api";

// ─── 상수 ────────────────────────────────────────────────
const STEPS = ["고객 유형", "조건 설정", "견적 확인"] as const;

const CUSTOMER_TYPE_OPTIONS: {
  type: CustomerType;
  title: string;
  desc: string;
  icon: ReactNode;
}[] = [
  {
    type: "individual",
    title: "개인",
    desc: "개인 명의로 계약을 진행해요",
    icon: <User size={22} strokeWidth={1.8} />,
  },
  {
    type: "self_employed",
    title: "개인사업자",
    desc: "사업자등록 기준으로 서류를 확인해요",
    icon: <BriefcaseBusiness size={22} strokeWidth={1.8} />,
  },
  {
    type: "corporate",
    title: "법인",
    desc: "법인 사업자등록 기준으로 진행해요",
    icon: <Building2 size={22} strokeWidth={1.8} />,
  },
];

// ─── 임시 목데이터 (결과 헤더 UI 검토용, 다음 회차에 진짜 API로 교체) ──
const MOCK_QUOTE = {
  vehicleName: "그랜저 IG",
  vehicleBrand: "현대",
  trimName: "익스클루시브",
  trimPrice: 43_840_000,
  monthlyPayment: 561_680,
  contractMonths: 36,
  annualMileage: 20_000,
  customerType: "individual" as CustomerType,
  productType: "장기렌트" as const,
  options: [
    { id: "1", name: "컴포트 II", price: 1_500_000 },
    { id: "2", name: "파노라마 선루프", price: 1_200_000 },
    { id: "3", name: "후석 스포일러", price: 350_000 },
  ],
  exteriorColor: { name: "판테라 메탈", priceDelta: 0 },
  interiorColor: { name: "블랙", priceDelta: 0 },
};

// ════════════════════════════════════════════════════════════
// 메인 — v2 뼈대
// ════════════════════════════════════════════════════════════
export function QuoteClientPageV2({ vehicles }: { vehicles: VehicleListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSlug = searchParams?.get("vehicle") ?? undefined;
  const customerTypeParam = searchParams?.get("customerType") ?? null;
  const initialCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;

  // 세션 id 는 마운트 시 1회만 생성 (v1 계약 동일).
  const [quoteSessionId] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : `quote-${Date.now()}`
  );

  const [step, setStep] = useState<1 | 2 | 3>(() =>
    initialCustomerType ? 2 : 1
  );
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialCustomerType ?? "individual"
  );
  const [selectedVehicle] = useState<VehicleListItem | null>(() =>
    prefillSlug ? vehicles.find((v) => v.slug === prefillSlug) ?? null : null
  );

  // 차량 없이 직접 접근한 경우 차량 탐색으로 redirect (v1 계약 동일)
  useEffect(() => {
    if (!prefillSlug) {
      router.replace("/cars");
    }
  }, [prefillSlug, router]);

  const goToStep = useCallback((s: 1 | 2 | 3) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // quoteSessionId 는 향후 API 호출/초안 저장에 쓰인다. 현재 뼈디단계에선 미사용 참조용.
  void quoteSessionId;

  const stepLabel = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-white pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-0">
      {/* ─── 모바일 미니멀 헤더 (토스풍) ─── */}
      <header className="sticky top-0 z-40 border-b border-[#E5E8EB] bg-white/95 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center gap-3 px-5">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-strong transition-colors hover:bg-surface-soft"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-text-strong">{stepLabel}</p>
          </div>
          <span className="num text-[13px] font-bold text-brand tabular-nums">
            {step}<span className="text-text-muted">/{STEPS.length}</span>
          </span>
        </div>
        {/* 얇은 진행 바 */}
        <div className="h-[2px] bg-[#E5E8EB]">
          <motion.div
            className="h-full bg-brand"
            initial={false}
            animate={{ width: `${(step / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </header>

      {/* ─── 데스크톱 헤더 (공간만, 내용은 다음 회차에 정리) ─── */}
      <div className="hidden border-b border-[#E5E8EB] bg-white md:block">
        <div className="mx-auto max-w-[680px] px-8 py-10">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-[12px] font-bold text-brand">
            실시간 견적
          </div>
          <h1 className="text-[32px] font-extrabold leading-[1.2] tracking-[-0.03em] text-text-strong">
            {stepLabel}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-body">
            보증금·선납금 없이 시작하거나, 초기 비용으로 월 납입금을 낮춰보세요.
          </p>
        </div>
      </div>

      {/* ─── 본문 ─── */}
      <main className="mx-auto max-w-[680px] px-5 py-8 md:px-8 md:py-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Step1CustomerType
              key="step1"
              customerType={customerType}
              onSelect={setCustomerType}
              onNext={() => goToStep(2)}
            />
          )}
          {step === 2 && (
            <Step2Placeholder
              key="step2"
              customerType={customerType}
              selectedVehicle={selectedVehicle}
              onNext={() => goToStep(3)}
              onPrev={() => goToStep(1)}
            />
          )}
          {step === 3 && (
            <Step3ResultHeader
              key="step3"
              customerType={customerType}
              onPrev={() => goToStep(2)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// STEP 1 — 고객 유형 (토스풍 화이트 카드)
// ════════════════════════════════════════════════════════════
function Step1CustomerType({
  customerType,
  onSelect,
  onNext,
}: {
  customerType: CustomerType;
  onSelect: (t: CustomerType) => void;
  onNext: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      className="space-y-8"
    >
      <div>
        <h2 className="text-[24px] font-extrabold leading-[1.3] tracking-[-0.03em] text-text-strong md:text-[28px]">
          누구 명의로
          <br />
          계약하시나요?
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-text-body">
          선택한 유형은 견적 저장과 계약 신청 서류 확인에 사용돼요.
        </p>
      </div>

      <div className="space-y-3">
        {CUSTOMER_TYPE_OPTIONS.map((option) => {
          const selected = customerType === option.type;
          return (
            <button
              key={option.type}
              type="button"
              onClick={() => onSelect(option.type)}
              className={cn(
                "flex w-full items-center gap-4 rounded-[20px] px-5 py-5 text-left transition-all duration-200 md:px-6 md:py-6",
                selected
                  ? "bg-brand-soft ring-[1.5px] ring-brand"
                  : "bg-[#F8FAFC] ring-[1.5px] ring-transparent hover:ring-[#E5E8EB]"
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] transition-colors",
                  selected ? "bg-brand text-white" : "bg-white text-text-body"
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-tight text-text-strong md:text-[18px]">
                  {option.title}
                </span>
                <span className="mt-1 block text-[13.5px] leading-snug text-text-body">
                  {option.desc}
                </span>
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all",
                  selected ? "bg-brand text-white" : "bg-[#E5E8EB] text-transparent"
                )}
              >
                <Check size={14} strokeWidth={2.6} />
              </span>
            </button>
          );
        })}
      </div>

      {/* 하단 고정 CTA */}
      <FixedCTA
        onClick={onNext}
        label="다음"
        icon={<ArrowRight size={16} strokeWidth={2.4} />}
      />
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════
// STEP 2 — 플레이스홀더 (다음 회차에 트림/옵션/조건 탭화)
// ════════════════════════════════════════════════════════════
function Step2Placeholder({
  customerType,
  selectedVehicle,
  onNext,
  onPrev,
}: {
  customerType: CustomerType;
  selectedVehicle: VehicleListItem | null;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <div className="rounded-[20px] bg-[#F8FAFC] p-5 md:p-6">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-brand">
          선택된 차량
        </p>
        <p className="mt-1.5 text-[18px] font-extrabold text-text-strong">
          {selectedVehicle?.name ?? "차량 미선택"}
        </p>
        <p className="mt-0.5 text-[13px] text-text-body">
          {CUSTOMER_TYPE_LABELS[customerType]} · 다음 회차에서 트림/옵션/조건 UI가 채워져요
        </p>
      </div>

      <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E5E8EB] bg-white p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8FAFC] text-text-muted">
          <BriefcaseBusiness size={20} />
        </div>
        <p className="mt-3 text-[14px] font-bold text-text-strong">트림 · 옵션 · 조건</p>
        <p className="mt-1 text-[13px] text-text-body">
          다음 작업 회차에서 토스풍 탭/아코디언으로 채워질 영역이에요.
        </p>
      </div>

      <FixedCTA
        onClick={onNext}
        label="월 납입금 확인 (목 mock)"
        icon={<ArrowRight size={16} strokeWidth={2.4} />}
        onPrev={onPrev}
        prevLabel="이전"
      />
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════
// STEP 3 — 결과 헤더 (월 납입금 TossPrice 대형 강조)
// ════════════════════════════════════════════════════════════
function Step3ResultHeader({
  customerType,
  onPrev,
}: {
  customerType: CustomerType;
  onPrev: () => void;
}) {
  const m = MOCK_QUOTE;
  const optionsTotal = m.options.reduce((sum, o) => sum + o.price, 0);
  const totalVehiclePrice = m.trimPrice + optionsTotal;

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      className="space-y-5"
    >
      {/* ── 1) 차량 정보 카드 (고객이 고른 선택 정보 종합) ── */}
      <div className="rounded-[24px] bg-[#F8FAFC] p-5 md:p-6">
        {/* 차량 썸네일 + 차명/트림 */}
        <div className="flex items-center gap-4">
          <div className="relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-[14px] bg-white">
            <Image
              src="/images/vehicles/benz-e-class.png"
              alt={m.vehicleName}
              fill
              sizes="120px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{m.vehicleBrand}</p>
            <p className="truncate text-[18px] font-extrabold leading-tight text-text-strong">{m.vehicleName}</p>
            <p className="mt-0.5 truncate text-[13.5px] text-text-body">{m.trimName}</p>
          </div>
        </div>

        {/* 구성 상세 — 옵션 + 색상 */}
        <div className="mt-5 space-y-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">선택한 구성</p>

          {/* 옵션 칩 */}
          <div className="flex flex-wrap gap-1.5">
            {m.options.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-text-body ring-[1px] ring-[#E5E8EB]"
              >
                {o.name}
              </span>
            ))}
          </div>

          {/* 색상 */}
          <div className="flex items-center gap-2 text-[13px] text-text-body">
            <span className="text-text-muted">외장</span>
            <span className="font-bold text-text-strong">{m.exteriorColor.name}</span>
            <span className="text-text-muted">· 내장</span>
            <span className="font-bold text-text-strong">{m.interiorColor.name}</span>
          </div>
        </div>

        {/* 구분선 */}
        <div className="my-4 h-[1px] bg-[#E5E8EB]" />

        {/* 계약 조건 3종 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[11px] text-text-muted">상품</p>
            <p className="mt-0.5 text-[13.5px] font-bold text-text-strong">{m.productType}</p>
          </div>
          <div>
            <p className="text-[11px] text-text-muted">계약기간</p>
            <p className="mt-0.5 num text-[13.5px] font-bold text-text-strong tabular-nums">{m.contractMonths}개월</p>
          </div>
          <div>
            <p className="text-[11px] text-text-muted">약정거리</p>
            <p className="mt-0.5 num text-[13.5px] font-bold text-text-strong tabular-nums">연 {(m.annualMileage / 10000).toFixed(0)}만km</p>
          </div>
        </div>

        {/* 구분선 */}
        <div className="my-4 h-[1px] bg-[#E5E8EB]" />

        {/* 차량가 요약 */}
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text-body">차량가 (트림 + 옵션)</span>
          <span className="num text-[14px] font-extrabold text-text-strong tabular-nums">
            {Math.round(totalVehiclePrice / 10_000).toLocaleString()}만원
          </span>
        </div>
      </div>

      {/* ── 2) 월 납입금 대형 강조 ── */}
      <div className="rounded-[24px] bg-brand p-6 text-white md:p-7">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-white/70">
          월 납입금
        </p>
        <div className="mt-2">
          <TossPrice won={m.monthlyPayment} size="xl" tone="white" />
        </div>
        <p className="mt-3 text-[13.5px] text-white/75">
          {CUSTOMER_TYPE_LABELS[customerType]} · 초기비용 없이 시작
        </p>
      </div>

      {/* ── 3) 보증금/선납 패널 + CTA 자리 (다음 회차) ── */}
      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E5E8EB] bg-white p-6 text-center">
        <p className="text-[13px] font-bold text-text-strong">초기비용 패널 · CTA 영역</p>
        <p className="mt-1 text-[12.5px] text-text-body">
          다음 회차: 보증금/선납 프리셋+슬라이더, 심사 요청/PDF/상담 CTA
        </p>
      </div>

      <FixedCTA
        onClick={onPrev}
        label="이전 단계로"
        icon={<ChevronLeft size={16} strokeWidth={2.4} />}
      />
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════
// 공용 — 하단 고정 CTA (토스풍 단일 버튼)
// ════════════════════════════════════════════════════════════
function FixedCTA({
  onClick,
  label,
  icon,
  onPrev,
  prevLabel,
}: {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  onPrev?: () => void;
  prevLabel?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E8EB] bg-white/95 px-5 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md md:static md:inset-auto md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="mx-auto flex max-w-[680px] gap-2">
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            className="flex h-[52px] items-center justify-center rounded-[14px] border border-[#E5E8EB] bg-white px-5 text-[15px] font-bold text-text-body transition-colors hover:bg-[#F8FAFC]"
          >
            {prevLabel ?? "이전"}
          </button>
        )}
        <button
          type="button"
          onClick={onClick}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(39,54,138,0.18)] transition-all hover:bg-brand-pressed active:scale-[0.99]"
        >
          {icon}
          {label}
        </button>
      </div>
    </div>
  );
}
