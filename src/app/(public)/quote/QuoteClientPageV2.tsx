"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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
import { sortLineups } from "@/lib/lineup-sort";
import { TossPrice } from "@/components/ui/TossPrice";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  isCustomerType,
} from "@/constants/customer-types";
import type { VehicleListItem, QuoteResponse } from "@/types/api";
import type { VehicleColorPublic } from "@/components/quote/ColorSelector";
import {
  type LineupChoice,
  type TrimChoice,
} from "@/components/quote/LineupTrimPicker";
import {
  readQuotePdfRestore,
  type QuotePdfRestoreState,
} from "@/lib/quote-draft";
import { Step2ConditionV2, type TrimDataV2 } from "./Step2ConditionV2";

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

// ─── 트림/옵션 타입 (v1 계약 유지) ───────────────────────
interface TrimOption {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  isAccessory: boolean;
  isDefault: boolean;
  badge: string | null;
}

interface TrimRule {
  id: string;
  ruleType: string;
  sourceOptionId: string;
  targetOptionId: string;
}

interface TrimData {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: TrimOption[];
  rules: TrimRule[];
  lineupId: string | null;
  lineup: { id: string; name: string } | null;
}

// ════════════════════════════════════════════════════════════
// 메인 — v2 (2회차: STEP 2 탭 + 실제 API 연동)
// ════════════════════════════════════════════════════════════
export function QuoteClientPageV2({ vehicles }: { vehicles: VehicleListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSlug = searchParams?.get("vehicle") ?? undefined;
  const customerTypeParam = searchParams?.get("customerType") ?? null;
  const initialCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;
  const isRestoreReturn = searchParams?.get("restore") === "1";
  const prefillOptionIds = searchParams?.get("options")?.split(",").filter(Boolean) ?? [];

  const [quoteSessionId] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : `quote-${Date.now()}`
  );

  const restoreRef = useRef<QuotePdfRestoreState | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(() =>
    isRestoreReturn ? 3 : initialCustomerType ? 2 : 1
  );
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialCustomerType ?? "individual"
  );
  const [selectedVehicle] = useState<VehicleListItem | null>(() =>
    prefillSlug ? vehicles.find((v) => v.slug === prefillSlug) ?? null : null
  );

  useEffect(() => {
    if (!prefillSlug) {
      router.replace("/cars");
    }
  }, [prefillSlug, router]);

  const [quoteResult, setQuoteResult] = useState<QuoteResponse | null>(null);

  const goToStep = useCallback((s: 1 | 2 | 3) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ─── 트림/옵션/색상/조건 상태 (v1 계약 그대로) ─────────
  const [trims, setTrims] = useState<TrimData[]>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  const [selectedLineup, setSelectedLineup] = useState<string | null>(null);
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [colors, setColors] = useState<VehicleColorPublic[]>([]);
  const [exteriorColorId, setExteriorColorId] = useState<string | null>(null);
  const [interiorColorId, setInteriorColorId] = useState<string | null>(null);

  const [contractCategory, setContractCategory] = useState<"장기렌트" | "리스">("장기렌트");
  const [conditions, setConditions] = useState<{ contractMonths: number; annualMileage: number }>({
    contractMonths: 60,
    annualMileage: 20000,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPrefilled = useRef(false);

  // ─── 트림/색상 fetch (v1 계약 그대로) ──────────────────
  useEffect(() => {
    if (!selectedVehicle) return;
    setTrimsLoading(true);
    setTrims([]);
    setSelectedLineup(null);
    setSelectedTrimId(null);
    setSelectedOptionIds(new Set());
    setColors([]);
    setExteriorColorId(null);
    setInteriorColorId(null);

    const slug = selectedVehicle.slug;
    const shouldPrefill = !!prefillSlug && !hasPrefilled.current;

    fetch(`/api/vehicles/${slug}/colors`)
      .then((r) => r.json())
      .then((json) => {
        if (!json?.success || !Array.isArray(json.data)) return;
        const list: VehicleColorPublic[] = json.data;
        setColors(list);
        const defaultExt = list.find((c) => c.kind === "EXTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "EXTERIOR");
        const defaultInt = list.find((c) => c.kind === "INTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "INTERIOR");
        const restore = restoreRef.current;
        const restoreExt = restore ? list.find((c) => c.id === restore.exteriorColorId) : undefined;
        const restoreInt = restore ? list.find((c) => c.id === restore.interiorColorId) : undefined;
        setExteriorColorId(restoreExt?.id ?? defaultExt?.id ?? null);
        setInteriorColorId(restoreInt?.id ?? defaultInt?.id ?? null);
      })
      .catch(() => {});

    fetch(`/api/vehicles/${slug}/trims`)
      .then((r) => r.json())
      .then((trimsJson) => {
        if (!trimsJson.success || trimsJson.data.length === 0) return;
        const loadedTrims: TrimData[] = trimsJson.data;
        setTrims(loadedTrims);

        const hasLineupInfo = loadedTrims.some(
          (t) => t.lineup?.name ?? (t.specs as Record<string, string> | null)?.lineup
        );

        const restore = restoreRef.current;
        if (restore && !hasPrefilled.current) {
          hasPrefilled.current = true;
          const restoreTrim =
            loadedTrims.find((t) => t.id === restore.quoteResult.trimId) ??
            loadedTrims.find((t) => t.isDefault) ??
            loadedTrims[0];
          const specs = restoreTrim.specs as Record<string, string> | null;
          const resolvedLineupName = restoreTrim.lineup?.name ?? specs?.lineup ?? "";
          if (hasLineupInfo && resolvedLineupName) {
            setSelectedLineup(resolvedLineupName);
            setSelectedTrimId(restoreTrim.id);
          } else {
            setSelectedLineup(restoreTrim.id);
          }
          if (restore.selectedOptionIds.length > 0) {
            const validIds = new Set(restoreTrim.options.map((o: TrimOption) => o.id));
            const toSelect = restore.selectedOptionIds.filter((id) => validIds.has(id));
            if (toSelect.length > 0) setSelectedOptionIds(new Set(toSelect));
          }
        } else if (shouldPrefill) {
          hasPrefilled.current = true;
          const lineupNameOf = (t: TrimData): string =>
            t.lineup?.name ?? (t.specs as Record<string, string> | null)?.lineup ?? "";
          const hasLineup = loadedTrims.some((t) => lineupNameOf(t));
          let defaultTrim = loadedTrims.find((t) => t.isDefault) ?? loadedTrims[0];
          if (hasLineup) {
            const topLineup = sortLineups([
              ...new Set(loadedTrims.map(lineupNameOf).filter(Boolean)),
            ])[0];
            const topLineupTrims = loadedTrims.filter((t) => lineupNameOf(t) === topLineup);
            if (topLineupTrims.length > 0) {
              defaultTrim = topLineupTrims.find((t) => t.isDefault) ?? topLineupTrims[0];
            }
          }
          const resolvedLineupName = lineupNameOf(defaultTrim);
          if (hasLineup && resolvedLineupName) {
            setSelectedLineup(resolvedLineupName);
            setSelectedTrimId(defaultTrim.id);
          } else {
            setSelectedLineup(defaultTrim.id);
          }
          if (prefillOptionIds.length > 0) {
            const validIds = new Set(defaultTrim.options.map((o: TrimOption) => o.id));
            const toSelect = prefillOptionIds.filter((id) => validIds.has(id));
            if (toSelect.length > 0) setSelectedOptionIds(new Set(toSelect));
          }
        }
      })
      .catch(() => {})
      .finally(() => setTrimsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle]);

  // ─── 복원 (v1 계약 그대로) ─────────────────────────────
  useEffect(() => {
    if (!isRestoreReturn) return;
    const restored = readQuotePdfRestore();
    if (restored && restored.vehicleSlug === prefillSlug) {
      restoreRef.current = restored;
      setCustomerType(restored.customerType);
      setContractCategory(restored.contractCategory);
      setConditions({
        contractMonths: restored.conditions.contractMonths,
        annualMileage: restored.conditions.annualMileage,
      });
      setQuoteResult(restored.quoteResult);
      setStep(3);
    } else {
      setStep(initialCustomerType ? 2 : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 캐스케이딩 파생 값 (v1 계약 그대로) ───────────────
  const getLineupName = (t: TrimData): string =>
    t.lineup?.name ?? (t.specs as Record<string, string> | null)?.lineup ?? "";

  const hasCascade = trims.some((t) => getLineupName(t));
  const availableLineups = hasCascade
    ? sortLineups([...new Set(trims.map((t) => getLineupName(t)).filter(Boolean))])
    : [];
  const trimsForLineup = selectedLineup
    ? trims.filter((t) => getLineupName(t) === selectedLineup)
    : [];
  const availableTrimNames = (() => {
    const list = trimsForLineup.map((t) => {
      const trimName = (t.specs as Record<string, string>)?.trimName ?? t.name;
      const extra =
        t.name !== trimName && t.name.includes(trimName)
          ? t.name.replace(trimName, "").trim().replace(/\s+/g, " ")
          : null;
      return { id: t.id, name: trimName, extra, price: t.price, discountPrice: t.discountPrice };
    });
    const nameCount = new Map<string, number>();
    list.forEach((it) => nameCount.set(it.name, (nameCount.get(it.name) ?? 0) + 1));
    return list.map((it) => ({
      ...it,
      extra: (nameCount.get(it.name) ?? 0) > 1 ? it.extra : null,
    }));
  })();

  const lineupChoices: LineupChoice[] = availableLineups.map((lineup) => ({
    name: lineup,
    trimCount: trims.filter((t) => getLineupName(t) === lineup).length,
  }));
  const cascadeTrimChoices: TrimChoice[] = availableTrimNames.map((t) => ({
    id: t.id,
    name: t.name,
    extra: t.extra,
    price: t.price,
    discountPrice: t.discountPrice ?? null,
  }));
  const flatTrimChoices: TrimChoice[] = trims.map((t) => ({
    id: t.id,
    name: t.name,
    extra: null,
    price: t.price,
    discountPrice: t.discountPrice ?? null,
  }));

  const selectedTrim: TrimData | null = hasCascade
    ? (selectedTrimId ? trimsForLineup.find((t) => t.id === selectedTrimId) ?? null : null)
    : trims.find((t) => t.id === selectedLineup) ?? null;

  const optionsTotalPrice = selectedTrim
    ? selectedTrim.options
        .filter((o) => selectedOptionIds.has(o.id))
        .reduce((sum, o) => sum + o.price, 0)
    : 0;

  const selectedExteriorColor = exteriorColorId ? colors.find((c) => c.id === exteriorColorId) ?? null : null;
  const selectedInteriorColor = interiorColorId ? colors.find((c) => c.id === interiorColorId) ?? null : null;
  const colorDelta = (selectedExteriorColor?.priceDelta ?? 0) + (selectedInteriorColor?.priceDelta ?? 0);

  const selectedOptionDetails =
    selectedTrim?.options
      .filter((option) => selectedOptionIds.has(option.id))
      .map((option) => ({ id: option.id, name: option.name, price: option.price })) ?? [];

  // ─── 옵션 토글 (REQUIRED/INCLUDED/CONFLICT 룰 — v1 계약 그대로) ──
  const handleOptionToggle = useCallback((optionId: string) => {
    setSelectedOptionIds((prev) => {
      const rules = selectedTrim?.rules ?? [];
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
        for (const rule of rules) {
          if (rule.sourceOptionId === optionId &&
            (rule.ruleType === "REQUIRED" || rule.ruleType === "INCLUDED")) {
            next.add(rule.targetOptionId);
          }
        }
        for (const rule of rules) {
          if (rule.sourceOptionId === optionId && rule.ruleType === "CONFLICT") {
            next.delete(rule.targetOptionId);
          }
        }
      }
      return next;
    });
  }, [selectedTrim]);

  // ─── 견적 계산 API (v1 계약 그대로) ────────────────────
  async function fetchQuote() {
    if (!selectedVehicle || !selectedTrim) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicle.slug}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimId: selectedTrim.id,
          selectedOptionIds: Array.from(selectedOptionIds),
          contractMonths: conditions.contractMonths,
          annualMileage: conditions.annualMileage,
          contractType: "반납형",
          productType: contractCategory,
          customerType,
          exteriorColorId,
          interiorColorId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "견적 계산에 실패했습니다.");
        return;
      }
      setQuoteResult(json.data as QuoteResponse);
      goToStep(3);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  // quoteSessionId 는 3회차(견적 초안 저장)에서 사용.
  void quoteSessionId;

  // ─── v2 톤 TrimDataV2 변환 ─────────────────────────────
  const selectedTrimV2: TrimDataV2 | null = selectedTrim
    ? {
        id: selectedTrim.id,
        name: selectedTrim.name,
        price: selectedTrim.price,
        discountPrice: selectedTrim.discountPrice,
        engineType: selectedTrim.engineType,
        fuelEfficiency: selectedTrim.fuelEfficiency,
        options: selectedTrim.options.map((o) => ({
          id: o.id,
          name: o.name,
          price: o.price,
          category: o.category,
          description: o.description,
          badge: o.badge,
        })),
        rules: selectedTrim.rules.map((r) => ({
          ruleType: r.ruleType,
          sourceOptionId: r.sourceOptionId,
          targetOptionId: r.targetOptionId,
        })),
      }
    : null;

  const stepLabel = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-white pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-0">
      {/* 모바일 미니멀 헤더 */}
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
        <div className="h-[2px] bg-[#E5E8EB]">
          <motion.div
            className="h-full bg-brand"
            initial={false}
            animate={{ width: `${(step / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </header>

      {/* 데스크톱 헤더 */}
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

      {/* 본문 */}
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
            <Step2ConditionV2
              key="step2"
              hasCascade={hasCascade}
              lineupChoices={lineupChoices}
              selectedLineup={selectedLineup}
              onLineupChange={(lineup) => {
                setSelectedLineup(lineup);
                setSelectedOptionIds(new Set());
              }}
              cascadeTrimChoices={cascadeTrimChoices}
              flatTrimChoices={flatTrimChoices}
              selectedTrimId={selectedTrimId}
              onTrimChange={(trimId) => {
                if (hasCascade) {
                  setSelectedTrimId(trimId);
                } else {
                  setSelectedLineup(trimId);
                }
                setSelectedOptionIds(new Set());
              }}
              selectedTrim={selectedTrimV2}
              trimsLoading={trimsLoading}
              selectedOptionIds={selectedOptionIds}
              onOptionToggle={handleOptionToggle}
              optionsTotalPrice={optionsTotalPrice}
              selectedOptionDetails={selectedOptionDetails}
              colors={colors}
              exteriorColorId={exteriorColorId}
              interiorColorId={interiorColorId}
              onColorChange={(kind, id) => {
                if (kind === "EXTERIOR") setExteriorColorId(id);
                else setInteriorColorId(id);
              }}
              colorDelta={colorDelta}
              contractCategory={contractCategory}
              onContractCategoryChange={setContractCategory}
              contractMonths={conditions.contractMonths}
              onContractMonthsChange={(m) => setConditions((p) => ({ ...p, contractMonths: m }))}
              annualMileage={conditions.annualMileage}
              onAnnualMileageChange={(m) => setConditions((p) => ({ ...p, annualMileage: m }))}
              onPrev={() => goToStep(1)}
              onCalculate={fetchQuote}
              isLoading={isLoading}
              error={error}
            />
          )}
          {step === 3 && quoteResult && (
            <Step3ResultHeader
              key="step3"
              quoteResult={quoteResult}
              selectedVehicle={selectedVehicle}
              customerType={customerType}
              contractCategory={contractCategory}
              selectedOptionDetails={selectedOptionDetails}
              selectedExteriorColor={selectedExteriorColor}
              selectedInteriorColor={selectedInteriorColor}
              onPrev={() => {
                setQuoteResult(null);
                setError(null);
                goToStep(2);
              }}
            />
          )}
          {step === 3 && !quoteResult && (
            <motion.div
              key="step3-restoring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-3 py-20"
            >
              <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <p className="text-[13px] text-text-body">견적 정보를 불러오는 중…</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// STEP 1 — 고객 유형 (1회차와 동일)
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

      <FixedCTA onClick={onNext} label="다음" icon={<ArrowRight size={16} strokeWidth={2.4} />} />
    </motion.section>
  );
}

// ════════════════════════════════════════════════════════════
// STEP 3 — 결과 (2회차: 실제 API 연동)
// ════════════════════════════════════════════════════════════
function Step3ResultHeader({
  quoteResult,
  selectedVehicle,
  customerType,
  contractCategory,
  selectedOptionDetails,
  selectedExteriorColor,
  selectedInteriorColor,
  onPrev,
}: {
  quoteResult: QuoteResponse;
  selectedVehicle: VehicleListItem | null;
  customerType: CustomerType;
  contractCategory: "장기렌트" | "리스";
  selectedOptionDetails: { id: string; name: string; price: number }[];
  selectedExteriorColor: { name: string; priceDelta: number } | null;
  selectedInteriorColor: { name: string; priceDelta: number } | null;
  onPrev: () => void;
}) {
  const monthly = quoteResult.scenarios.standard.monthlyPayment;
  const totalVehiclePrice =
    quoteResult.totalVehiclePrice ??
    quoteResult.trimPrice + (quoteResult.optionsTotalPrice ?? 0);

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      className="space-y-5"
    >
      {/* ── 1) 차량 정보 카드 (실제 데이터) ── */}
      <div className="rounded-[24px] bg-[#F8FAFC] p-5 md:p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-[72px] w-[108px] shrink-0 overflow-hidden rounded-[14px] bg-white">
            {selectedVehicle?.thumbnailUrl ? (
              <Image
                src={selectedVehicle.thumbnailUrl}
                alt={selectedVehicle.name ?? "차량"}
                fill
                sizes="120px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[11px] text-text-muted">
                이미지 없음
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-muted">{selectedVehicle?.brand}</p>
            <p className="truncate text-[18px] font-extrabold leading-tight text-text-strong">{selectedVehicle?.name}</p>
            {quoteResult.trimName && (
              <p className="mt-0.5 truncate text-[13.5px] text-text-body">{quoteResult.trimName}</p>
            )}
          </div>
        </div>

        {/* 선택한 구성 */}
        <div className="mt-5 space-y-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">선택한 구성</p>

          {selectedOptionDetails.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedOptionDetails.map((o) => (
                <span
                  key={o.id}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-text-body ring-[1px] ring-[#E5E8EB]"
                >
                  {o.name}
                </span>
              ))}
            </div>
          )}

          {(selectedExteriorColor || selectedInteriorColor) && (
            <div className="flex items-center gap-2 text-[13px] text-text-body">
              {selectedExteriorColor && (
                <>
                  <span className="text-text-muted">외장</span>
                  <span className="font-bold text-text-strong">{selectedExteriorColor.name}</span>
                </>
              )}
              {selectedExteriorColor && selectedInteriorColor && <span className="text-text-muted">·</span>}
              {selectedInteriorColor && (
                <>
                  <span className="text-text-muted">내장</span>
                  <span className="font-bold text-text-strong">{selectedInteriorColor.name}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="my-4 h-[1px] bg-[#E5E8EB]" />

        {/* 계약 조건 */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[11px] text-text-muted">상품</p>
            <p className="mt-0.5 text-[13.5px] font-bold text-text-strong">{contractCategory}</p>
          </div>
          <div>
            <p className="text-[11px] text-text-muted">계약기간</p>
            <p className="mt-0.5 num text-[13.5px] font-bold text-text-strong tabular-nums">{quoteResult.contractMonths}개월</p>
          </div>
          <div>
            <p className="text-[11px] text-text-muted">약정거리</p>
            <p className="mt-0.5 num text-[13.5px] font-bold text-text-strong tabular-nums">연 {(quoteResult.annualMileage / 10000).toFixed(0)}만km</p>
          </div>
        </div>

        <div className="my-4 h-[1px] bg-[#E5E8EB]" />

        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text-body">차량가 (트림 + 옵션)</span>
          <span className="num text-[14px] font-extrabold text-text-strong tabular-nums">
            {Math.round(totalVehiclePrice / 10_000).toLocaleString()}만원
          </span>
        </div>
      </div>

      {/* ── 2) 월 납입금 대형 강조 (실제 데이터) ── */}
      <div className="rounded-[24px] bg-brand p-6 text-white md:p-7">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-white/70">월 납입금</p>
        <div className="mt-2">
          <TossPrice won={monthly} size="xl" tone="white" />
        </div>
        <p className="mt-3 text-[13.5px] text-white/75">
          {CUSTOMER_TYPE_LABELS[customerType]} · 초기비용 없이 시작
        </p>
      </div>

      {/* ── 3) 보증금/선납 패널 + CTA 자리 (3회차) ── */}
      <div className="flex min-h-[140px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#E5E8EB] bg-white p-6 text-center">
        <p className="text-[13px] font-bold text-text-strong">초기비용 패널 · CTA 영역</p>
        <p className="mt-1 text-[12.5px] text-text-body">
          다음 회차: 보증금/선납 프리셋+슬라이더, 심사 요청/PDF/상담 CTA
        </p>
      </div>

      <FixedCTA onClick={onPrev} label="이전 단계로" icon={<ChevronLeft size={16} strokeWidth={2.4} />} />
    </motion.section>
  );
}

// ─── 공용 FixedCTA ──────────────────────────────────────
function FixedCTA({
  onClick,
  label,
  icon,
  onPrev,
}: {
  onClick: () => void;
  label: string;
  icon?: ReactNode;
  onPrev?: () => void;
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
            이전
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
