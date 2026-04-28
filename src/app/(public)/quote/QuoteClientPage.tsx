"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Sparkles,
  Calculator,
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  Building2,
  BriefcaseBusiness,
  HeartHandshake,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QuoteBreakdownTabs } from "@/components/quote/QuoteBreakdownTabs";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { ComparisonSection } from "@/components/quote/ComparisonSection";
import type { VehicleListItem } from "@/types/api";
import type { QuoteResponse } from "@/types/api";
import type { QuoteScenarioDetail } from "@/types/quote";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  isCustomerType,
} from "@/constants/customer-types";

// ─── 상수 ────────────────────────────────────────────────
const CONTRACT_CATEGORIES = ["장기렌트", "리스"] as const;
const CONTRACT_MONTHS = [36, 48, 60] as const;
const ANNUAL_MILEAGES = [10000, 20000, 30000] as const;
const CONTRACT_TYPES = ["반납형", "인수형"] as const;

type ContractCategory = (typeof CONTRACT_CATEGORIES)[number];
type ContractMonths = (typeof CONTRACT_MONTHS)[number];
type AnnualMileage = (typeof ANNUAL_MILEAGES)[number];
type ContractType = (typeof CONTRACT_TYPES)[number];

interface Conditions {
  contractMonths: ContractMonths;
  annualMileage: AnnualMileage;
  contractType: ContractType;
}

// ─── 트림/옵션 타입 ───────────────────────────────────────
interface TrimOption {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  isAccessory: boolean;
  isDefault: boolean;
}

interface TrimData {
  id: string;
  name: string;
  price: number;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: TrimOption[];
}

// ─── 캐스케이딩 셀렉트 행 ─────────────────────────────────
function SelectRow({
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
      <p className="text-[12px] font-medium text-ink-caption mb-1.5 uppercase tracking-wide">
        {label}
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-white border border-neutral-800 rounded-btn
                     px-4 py-2.5 text-[14px] pr-9
                     focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10
                     transition-colors duration-150 cursor-pointer
                     text-ink disabled:text-ink-caption"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={15}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-caption pointer-events-none"
        />
      </div>
    </div>
  );
}

// ─── 스텝 인디케이터 ──────────────────────────────────────
const STEPS = ["고객 유형", "조건 설정", "견적 확인"] as const;

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

const CUSTOMER_TYPE_OPTIONS: {
  type: CustomerType;
  desc: string;
  icon: ReactNode;
}[] = [
  {
    type: "individual",
    desc: "개인 명의로 계약을 진행합니다.",
    icon: <User size={18} />,
  },
  {
    type: "self_employed",
    desc: "개인사업자 등록 기준으로 서류를 확인합니다.",
    icon: <BriefcaseBusiness size={18} />,
  },
  {
    type: "corporate",
    desc: "법인 사업자등록 기준으로 진행합니다.",
    icon: <Building2 size={18} />,
  },
  {
    type: "nonprofit",
    desc: "비영리법인 사업자등록 기준으로 진행합니다.",
    icon: <HeartHandshake size={18} />,
  },
];

// ─── 메인 ────────────────────────────────────────────────
export function QuoteClientPage({ vehicles }: { vehicles: VehicleListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSlug = searchParams.get("vehicle") ?? undefined;
  const customerTypeParam = searchParams.get("customerType");
  const initialCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;
  const quoteSessionId = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `quote-${Date.now()}`
  ).current;
  // 추천 결과에서 넘어온 TrimOption IDs (pre-select용)
  const prefillOptionIds = searchParams.get("options")?.split(",").filter(Boolean) ?? [];

  const [step, setStep] = useState<1 | 2 | 3>(() => (initialCustomerType ? 2 : 1));
  const [customerType, setCustomerType] = useState<CustomerType>(
    initialCustomerType ?? "individual"
  );
  const [selectedVehicle] = useState<VehicleListItem | null>(() =>
    prefillSlug ? vehicles.find((v) => v.slug === prefillSlug) ?? null : null
  );

  // 차량 없이 직접 접근한 경우 차량 탐색으로 redirect
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

  const handleContractApply = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    // 견적 데이터를 세션 스토리지에 임시 저장 (인증 후 저장하기 위함)
    if (quoteResult) {
      sessionStorage.setItem(`quote_${quoteSessionId}`, JSON.stringify({
        ...quoteResult,
        sessionId: quoteSessionId,
        customerType,
      }));
    }

    const target = `/verify?sessionId=${quoteSessionId}&vehicle=${selectedVehicle?.slug ?? ""}&customerType=${customerType}`;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  }, [router, quoteSessionId, selectedVehicle?.slug, quoteResult, customerType]);

  // 트림/옵션 상태
  const [trims, setTrims] = useState<TrimData[]>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  // 캐스케이딩 선택 상태
  const [selectedLineup, setSelectedLineup] = useState<string | null>(null);
  const [selectedTrimName, setSelectedTrimName] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());

  const [contractCategory, setContractCategory] = useState<ContractCategory>("장기렌트");
  const [conditions, setConditions] = useState<Conditions>({
    contractMonths: 48,
    annualMileage: 20000,
    contractType: "반납형",
  });
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // 장기렌트 선택 시 반납형 고정
  useEffect(() => {
    if (contractCategory === "장기렌트") {
      setConditions((prev) => ({ ...prev, contractType: "반납형" }));
    }
  }, [contractCategory]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customRates, setCustomRates] = useState({ depositRate: 0, prepayRate: 0 });
  const [isRecalculating, setIsRecalculating] = useState(false);
  const baseStandardScenario = useRef<QuoteScenarioDetail | null>(null);
  const recalculateRequestId = useRef(0);

  // 추천 프리필을 한 번만 적용하기 위한 플래그
  const hasPrefilled = useRef(false);

  // 차량 선택 시 트림 로드
  useEffect(() => {
    if (!selectedVehicle) return;
    setTrimsLoading(true);
    setTrims([]);
    setSelectedLineup(null);
    setSelectedTrimName(null);
    setSelectedOptionIds(new Set());

    const slug = selectedVehicle.slug;
    const shouldPrefill = !!prefillSlug && !hasPrefilled.current;

    fetch(`/api/vehicles/${slug}/trims`)
      .then((r) => r.json())
      .then((trimsJson) => {
        if (!trimsJson.success || trimsJson.data.length === 0) return;
        const loadedTrims: TrimData[] = trimsJson.data;
        setTrims(loadedTrims);

        if (shouldPrefill) {
          hasPrefilled.current = true;
          const defaultTrim = loadedTrims.find((t) => t.isDefault) ?? loadedTrims[0];
          const specs = defaultTrim.specs as Record<string, string> | null;
          const hasLineup = loadedTrims.some(
            (t) => (t.specs as Record<string, string> | null)?.lineup
          );
          if (hasLineup && specs?.lineup) {
            setSelectedLineup(specs.lineup);
            setSelectedTrimName(specs.trimName ?? defaultTrim.name);
          } else {
            setSelectedLineup(defaultTrim.id);
          }

          // TrimOption pre-select: URL의 options 파라미터와 기본 트림의 옵션 ID 교집합
          if (prefillOptionIds.length > 0) {
            const validIds = new Set(defaultTrim.options.map((o: TrimOption) => o.id));
            const toSelect = prefillOptionIds.filter((id) => validIds.has(id));
            if (toSelect.length > 0) setSelectedOptionIds(new Set(toSelect));
          }
        }
      })
      .catch(() => {})
      .finally(() => setTrimsLoading(false));
  }, [selectedVehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 캐스케이딩 파생 값 ──────────────────────────────────
  // 트림에 lineup 스펙이 있는지 확인
  const hasCascade = trims.some((t) => (t.specs as Record<string, string> | null)?.lineup);

  // 1단계: 유니크 라인업 목록
  const availableLineups = hasCascade
    ? (() => {
        const all = [...new Set(trims.map((t) => (t.specs as Record<string, string>)?.lineup ?? "").filter(Boolean))];
        const getYear = (s: string) => parseInt(s.match(/\d{4}/)?.[0] ?? "0");
        const getGroup = (s: string) => s.replace(/^\d{4}년형\s*/, "");
        const groupOrder: string[] = [];
        for (const l of all) {
          const g = getGroup(l);
          if (!groupOrder.includes(g)) groupOrder.push(g);
        }
        return all.sort((a, b) => {
          const ga = getGroup(a), gb = getGroup(b);
          const gi = groupOrder.indexOf(ga) - groupOrder.indexOf(gb);
          if (gi !== 0) return gi;
          return getYear(b) - getYear(a);
        });
      })()
    : [];

  // 2단계: 선택된 라인업에 속하는 트림들
  const trimsForLineup = selectedLineup
    ? trims.filter((t) => (t.specs as Record<string, string>)?.lineup === selectedLineup)
    : [];

  // 유니크 트림명 (가격 포함)
  const availableTrimNames = [
    ...new Map(
      trimsForLineup.map((t) => {
        const name = (t.specs as Record<string, string>)?.trimName ?? t.name;
        return [name, { name, price: t.price, id: t.id }];
      })
    ).values(),
  ];

  // 최종 선택된 트림 객체
  const selectedTrim =
    hasCascade
      ? (selectedTrimName
          ? trimsForLineup.find(
              (t) => (t.specs as Record<string, string>)?.trimName === selectedTrimName
            ) ?? null
          : null)
      : trims.find((t) => t.id === selectedLineup) ?? null;

  const selectedTrimId = selectedTrim?.id ?? null;

  const optionsTotalPrice = selectedTrim
    ? selectedTrim.options
        .filter((o) => selectedOptionIds.has(o.id))
        .reduce((sum, o) => sum + o.price, 0)
    : 0;

  const restoreBaseStandardScenario = useCallback(() => {
    recalculateRequestId.current += 1;
    setIsRecalculating(false);
    const standard = baseStandardScenario.current;
    if (!standard) return;

    setQuoteResult((prev) =>
      prev
        ? { ...prev, scenarios: { ...prev.scenarios, standard } }
        : prev
    );
  }, []);

  // Step 2 → Step 3: 견적 계산 API 호출
  async function fetchQuote() {
    if (!selectedVehicle) return;
    setIsLoading(true);
    setError(null);
    setPdfError(null);

    try {
      const res = await fetch(
        `/api/vehicles/${selectedVehicle.slug}/quote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trimId: selectedTrimId ?? undefined,
            selectedOptionIds: Array.from(selectedOptionIds),
            contractMonths: conditions.contractMonths,
            annualMileage: conditions.annualMileage,
            contractType: conditions.contractType,
            productType: contractCategory,
            customerType,
          }),
        }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "견적 계산에 실패했습니다.");
        return;
      }

      const nextResult = json.data as QuoteResponse;
      recalculateRequestId.current += 1;
      baseStandardScenario.current = nextResult.scenarios.standard;
      setCustomRates({ depositRate: 0, prepayRate: 0 });
      setQuoteResult(nextResult);
      goToStep(3);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function recalculateStandard(rates: { depositRate: number; prepayRate: number }) {
    if (!selectedVehicle || !quoteResult) return;
    const requestId = recalculateRequestId.current + 1;
    recalculateRequestId.current = requestId;

    if (rates.depositRate === 0 && rates.prepayRate === 0) {
      restoreBaseStandardScenario();
      return;
    }

    setIsRecalculating(true);
    try {
      const res = await fetch(`/api/vehicles/${selectedVehicle.slug}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trimId: selectedTrimId ?? undefined,
          selectedOptionIds: Array.from(selectedOptionIds),
          contractMonths: conditions.contractMonths,
          annualMileage: conditions.annualMileage,
          contractType: conditions.contractType,
          productType: contractCategory,
          customDepositRate: rates.depositRate,
          customPrepayRate: rates.prepayRate,
          customerType,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return;
      if (requestId !== recalculateRequestId.current) return;

      setQuoteResult((prev) =>
        prev
          ? { ...prev, scenarios: { ...prev.scenarios, standard: json.data.scenarios.standard } }
          : prev
      );
    } finally {
      if (requestId === recalculateRequestId.current) {
        setIsRecalculating(false);
      }
    }
  }

  // 슬라이더 변경 시 500ms 디바운스 재계산
  useEffect(() => {
    if (!quoteResult || !selectedVehicle) return;

    const rates = customRates;
    const handle = setTimeout(() => { recalculateStandard(rates); }, 500);
    return () => clearTimeout(handle);
  // recalculateStandard는 같은 값 deps를 쓰므로 의도적으로 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customRates.depositRate, customRates.prepayRate]);

  async function handlePdfDownload() {
    if (!quoteResult || !selectedVehicle) return;

    setIsPdfDownloading(true);
    setPdfError(null);

    const selectedOptions =
      selectedTrim?.options
        .filter((option) => selectedOptionIds.has(option.id))
        .map((option) => ({ name: option.name, price: option.price })) ?? [];

    const payload: Partial<PDFQuoteData> = {
      vehicleName: selectedVehicle.name,
      vehicleBrand: selectedVehicle.brand,
      trimName: quoteResult.trimName,
      trimPrice: quoteResult.trimPrice,
      selectedOptions,
      totalVehiclePrice:
        quoteResult.totalVehiclePrice ??
        quoteResult.trimPrice + (quoteResult.optionsTotalPrice ?? optionsTotalPrice),
      productType: contractCategory,
      contractMonths: quoteResult.contractMonths,
      annualMileage: quoteResult.annualMileage,
      contractType: quoteResult.contractType,
      scenarios: quoteResult.scenarios,
    };

    try {
      const response = await fetch("/api/quote/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        setPdfError(json?.error ?? "PDF 다운로드에 실패했습니다.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const fallbackName = `아임딜러_견적서_${selectedVehicle.name}.pdf`;
      const filename = encodedFilename ? decodeURIComponent(encodedFilename) : fallbackName;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError("PDF 다운로드 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsPdfDownloading(false);
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
          <h1 className="font-display text-headline-sm text-ink">
            조건을 설정하면 실시간으로 계산됩니다
          </h1>
          <p className="text-[14px] text-ink-label mt-1">
            개인정보 없이, 보수형·표준형·공격형 3가지 시나리오를 바로 확인하세요
          </p>
        </div>
      </div>

      <div className="page-container py-8">
        <div className="max-w-4xl mx-auto">
          <StepBar currentStep={step} />

          <AnimatePresence mode="wait">
            {/* ── STEP 1: 고객 유형 선택 ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card p-6 mb-4">
                  <h2 className="text-[17px] font-medium text-ink mb-2">
                    계약할 고객 유형을 선택하세요
                  </h2>
                  <p className="text-[13px] text-ink-caption mb-5">
                    선택한 유형은 견적 저장과 계약 신청 서류 확인에 사용됩니다.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CUSTOMER_TYPE_OPTIONS.map((option) => {
                      const selected = customerType === option.type;
                      return (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => setCustomerType(option.type)}
                          className={cn(
                            "flex items-start gap-3 rounded-[8px] border p-4 text-left transition-all duration-150",
                            selected
                              ? "border-primary bg-primary-100"
                              : "border-[#F0F0F0] bg-white hover:border-primary/30 hover:bg-neutral"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              selected
                                ? "bg-primary text-white"
                                : "bg-neutral text-ink-label"
                            )}
                          >
                            {option.icon}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block text-[14px] font-semibold",
                                selected ? "text-primary" : "text-ink"
                              )}
                            >
                              {CUSTOMER_TYPE_LABELS[option.type]}
                            </span>
                            <span className="mt-1 block text-[12px] leading-relaxed text-ink-caption">
                              {option.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => router.push("/cars")}
                    className="inline-flex items-center gap-1.5 text-[13px] text-ink-caption hover:text-ink transition-colors"
                  >
                    <ChevronLeft size={15} />
                    차량 탐색으로 돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-btn bg-primary text-white text-[14px] font-medium hover:opacity-90 transition-all duration-200"
                  >
                    조건 설정하기
                    <Calculator size={15} />
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
                        <p className="text-[12px] text-ink-caption mt-0.5">
                          고객 유형: {CUSTOMER_TYPE_LABELS[customerType]}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="ml-auto text-[12px] text-ink-caption hover:text-primary transition-colors"
                      >
                        유형 변경
                      </button>
                    </div>
                  )}

                  {/* ── 캐스케이딩 트림 선택 ── */}
                  {trimsLoading ? (
                    <div className="flex items-center gap-2 h-11 mb-5 text-[13px] text-ink-caption">
                      <span className="w-3.5 h-3.5 border-2 border-neutral-700 border-t-primary rounded-full animate-spin" />
                      트림 정보 불러오는 중...
                    </div>
                  ) : trims.length > 0 ? (
                    <div className="mb-5 space-y-3">

                      {hasCascade ? (
                        <>
                          {/* 1단계: 라인업 선택 */}
                          <SelectRow
                            label="라인업"
                            value={selectedLineup ?? ""}
                            placeholder="연식 / 엔진을 선택하세요"
                            options={availableLineups.map((l) => ({ value: l, label: l }))}
                            onChange={(v) => {
                              setSelectedLineup(v || null);
                              setSelectedTrimName(null);
                              setSelectedOptionIds(new Set());
                            }}
                          />

                          {/* 2단계: 트림명 선택 (라인업 선택 후 노출) */}
                          {selectedLineup && (
                            <SelectRow
                              label="트림"
                              value={selectedTrimName ?? ""}
                              placeholder="트림을 선택하세요"
                              options={availableTrimNames.map((t) => ({
                                value: t.name,
                                label: `${t.name} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                              }))}
                              onChange={(v) => {
                                setSelectedTrimName(v || null);
                                setSelectedOptionIds(new Set());
                              }}
                            />
                          )}
                        </>
                      ) : (
                        /* 라인업 없는 차량: 트림 직접 선택 */
                        <SelectRow
                          label="트림"
                          value={selectedLineup ?? ""}
                          placeholder="트림을 선택하세요"
                          options={trims.map((t) => ({
                            value: t.id,
                            label: `${t.name} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                          }))}
                          onChange={(v) => {
                            setSelectedLineup(v || null);
                            setSelectedOptionIds(new Set());
                          }}
                        />
                      )}

                      {/* 추가 옵션 (TrimOption 체크리스트, 추천결과 선택 항목 pre-select) */}
                      {selectedTrim && selectedTrim.options.length > 0 && (
                        <div>
                          <p className="text-[12px] font-medium text-ink-caption mb-1.5 uppercase tracking-wide">
                            추가 옵션
                            <span className="normal-case font-normal ml-1 opacity-60">(선택)</span>
                          </p>
                          <div className="border border-neutral-800 rounded-btn overflow-hidden divide-y divide-[#F0F0F0]">
                            {selectedTrim.options.map((opt) => {
                              const isOptSelected = selectedOptionIds.has(opt.id);
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    setSelectedOptionIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(opt.id)) next.delete(opt.id);
                                      else next.add(opt.id);
                                      return next;
                                    })
                                  }
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100",
                                    isOptSelected ? "bg-primary-100" : "bg-white hover:bg-neutral"
                                  )}
                                >
                                  <div className={cn(
                                    "w-4 h-4 rounded border-[1.5px] shrink-0 flex items-center justify-center",
                                    isOptSelected ? "bg-primary border-primary" : "border-neutral-600 bg-white"
                                  )}>
                                    {isOptSelected && <Check size={9} strokeWidth={3} className="text-white" />}
                                  </div>
                                  <span className={cn("flex-1 text-[13px]", isOptSelected ? "text-primary font-medium" : "text-ink")}>
                                    {opt.name}
                                  </span>
                                  <span className={cn("text-[12px] font-medium shrink-0", isOptSelected ? "text-primary" : "text-ink-label")}>
                                    +{opt.price >= 10000
                                      ? `${Math.round(opt.price / 10000).toLocaleString()}만원`
                                      : `${opt.price.toLocaleString()}원`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {selectedOptionIds.size > 0 && (
                            <p className="text-[12px] text-primary font-medium text-right mt-1.5">
                              옵션 +{Math.round(optionsTotalPrice / 10000).toLocaleString()}만원 · 합계{" "}
                              <span className="font-semibold">
                                {Math.round((selectedTrim.price + optionsTotalPrice) / 10000).toLocaleString()}만원
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {/* 선택된 트림 가격 요약 */}
                      {selectedTrim && (
                        <div className="flex items-center justify-between py-2 px-3 bg-neutral rounded-[6px] text-[12px]">
                          <span className="text-ink-caption">
                            {selectedTrim.engineType}
                            {selectedTrim.fuelEfficiency ? ` · 연비 ${selectedTrim.fuelEfficiency}km/L` : ""}
                          </span>
                          <span className="font-semibold text-ink">
                            차량가 {Math.round((selectedTrim.price + optionsTotalPrice) / 10000).toLocaleString()}만원
                          </span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* 구분선 */}
                  {selectedTrim && <div className="border-t border-[#F0F0F0] mb-5" />}

                  <h2 className="text-[17px] font-medium text-ink mb-6">
                    계약 조건을 설정하세요
                  </h2>

                  {/* ① 상품 유형 */}
                  <div className="mb-6">
                    <p className="text-[13px] font-medium text-ink-label mb-1.5">
                      상품 유형
                    </p>
                    <p className="text-[12px] text-ink-caption mb-3">
                      장기렌트: 보험·세금 포함, 전액 비용처리 · 리스: 차량 소유권 이전 가능
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CONTRACT_CATEGORIES.map((c) => (
                        <OptionButton
                          key={c}
                          selected={contractCategory === c}
                          onClick={() => setContractCategory(c)}
                        >
                          {c}
                        </OptionButton>
                      ))}
                    </div>
                  </div>

                  {contractCategory === "리스" && (
                    <div className="bg-neutral border border-neutral-800 rounded-[8px] p-4 text-[13px] text-ink-caption mb-6 flex items-start gap-2">
                      <Sparkles size={13} className="text-primary shrink-0 mt-0.5" />
                      <p>리스 견적은 임시 데이터 기준입니다. 실제 금융사 조건과 다를 수 있습니다.</p>
                    </div>
                  )}

                  {(contractCategory === "장기렌트" || contractCategory === "리스") && (
                    <>
                      {/* ② 계약기간 */}
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

                      {/* ③ 연간 약정거리 */}
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

                      {/* ④ 계약 종류 */}
                      <div>
                        <p className="text-[13px] font-medium text-ink-label mb-1.5">
                          계약 종류
                        </p>
                        <p className="text-[12px] text-ink-caption mb-3">
                          {contractCategory === "리스"
                            ? "반납형: 계약 종료 후 반납 · 인수형: 잔존가치로 차량 매입"
                            : "장기렌트는 반납형이 기본입니다 · 인수형: 잔존가치로 차량 매입 (월 납입금 +12% 적용)"}
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
                    </>
                  )}
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
                    onClick={() => router.push("/cars")}
                    className="inline-flex items-center gap-1.5 text-[13px] text-ink-caption hover:text-ink transition-colors"
                  >
                    <ChevronLeft size={15} />
                    차량 탐색으로 돌아가기
                  </button>
                  <button
                    type="button"
                    disabled={isLoading || !selectedTrim}
                    onClick={fetchQuote}
                    className={cn(
                      "inline-flex items-center gap-2 px-6 py-3 rounded-btn text-[14px] font-medium transition-all duration-200",
                      isLoading || !selectedTrim
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
                        {selectedTrim ? "견적 계산하기" : "트림을 선택하세요"}
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
                    {(quoteResult as QuoteResponse & { optionsTotalPrice?: number }).optionsTotalPrice
                      ? (
                        <span className="text-ink-label">
                          옵션 +{Math.round(((quoteResult as QuoteResponse & { optionsTotalPrice?: number }).optionsTotalPrice ?? 0) / 10000).toLocaleString()}만원
                        </span>
                      )
                      : null}
                    <span className="text-ink-label">
                      계약 {quoteResult.contractMonths}개월
                    </span>
                    <span className="text-ink-label">
                      연 {(quoteResult.annualMileage / 10000).toFixed(0)}만km
                    </span>
                    <span className="text-ink-label">{quoteResult.contractType}</span>
                    <span className="text-ink-label">
                      {CUSTOMER_TYPE_LABELS[customerType]}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        goToStep(2);
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
                  <QuoteBreakdownTabs
                    scenarios={quoteResult.scenarios}
                    customerType={customerType}
                    customRates={customRates}
                    onCustomRatesChange={setCustomRates}
                    isRecalculating={isRecalculating}
                    onTabChange={(tab) => {
                      if (tab !== "standard") {
                        setCustomRates({ depositRate: 0, prepayRate: 0 });
                        restoreBaseStandardScenario();
                      }
                    }}
                  />
                </div>

                {selectedVehicle && (
                  <ComparisonSection
                    primary={{
                      slug: selectedVehicle.slug,
                      brand: selectedVehicle.brand,
                      name: selectedVehicle.name,
                      result: quoteResult,
                    }}
                    conditions={{
                      contractMonths: conditions.contractMonths,
                      annualMileage: conditions.annualMileage,
                      contractType: conditions.contractType,
                      productType: contractCategory,
                    }}
                    allVehicles={vehicles}
                  />
                )}

                {/* 면책 안내 */}
                <div className="bg-neutral rounded-[8px] border border-[#F0F0F0] p-4 text-[12px] text-ink-caption mb-4 leading-relaxed">
                  위 견적은 실제 계약 가능한 기준으로 계산되었으나, 최종 금액은
                  차량 상태·옵션·프로모션에 따라 달라질 수 있습니다. 전문가
                  상담을 통해 확정 견적을 받으시길 권장합니다.
                </div>

                {/* PDF 다운로드 */}
                <button
                  type="button"
                  onClick={handlePdfDownload}
                  disabled={isPdfDownloading}
                  className={cn(
                    "flex items-center justify-center gap-2 w-full py-3 rounded-btn border text-[14px] font-semibold transition-all duration-150 mb-2",
                    isPdfDownloading
                      ? "border-neutral-800 bg-neutral text-ink-caption cursor-not-allowed"
                      : "border-primary text-primary bg-white hover:bg-primary-100 active:scale-[0.98]"
                  )}
                >
                  {isPdfDownloading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                      PDF 생성 중...
                    </>
                  ) : (
                    <>
                      <Download size={15} strokeWidth={2} />
                      견적서 PDF 다운로드
                    </>
                  )}
                </button>

                {pdfError && (
                  <div className="bg-[#FFEBEB] border border-red-100 rounded-[8px] p-3 text-[12px] text-destructive flex items-start gap-2 mb-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <p>{pdfError}</p>
                  </div>
                )}

                {/* 계약 신청하기 */}
                <button
                  type="button"
                  onClick={handleContractApply}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-btn
                             bg-primary text-white text-[14px] font-semibold
                             hover:bg-primary/90 active:scale-[0.98]
                             transition-all duration-150 mb-2"
                >
                  <ClipboardCheck size={15} strokeWidth={2} />
                  이 견적으로 계약 신청하기
                </button>

                {/* 상담 버튼 */}
                <ChannelTalkButton vehicleName={selectedVehicle?.name} />

                {/* 하단 링크 */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0F0F0]">
                  <button
                    type="button"
                    onClick={() => router.push("/cars")}
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

    </div>
  );
}
