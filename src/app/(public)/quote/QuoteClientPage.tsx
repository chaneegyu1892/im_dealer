"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Calculator,
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  Building2,
  BriefcaseBusiness,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sortLineups } from "@/lib/lineup-sort";
import { QuoteBreakdownTabs, type CostMode } from "@/components/quote/QuoteBreakdownTabs";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { ComparisonSection } from "@/components/quote/ComparisonSection";
import { ColorSelector, type VehicleColorPublic } from "@/components/quote/ColorSelector";
import { EvSubsidyNotice } from "@/components/quote/EvSubsidyNotice";
import {
  LineupTrimPicker,
  type LineupChoice,
  type TrimChoice,
} from "@/components/quote/LineupTrimPicker";
import type { VehicleListItem } from "@/types/api";
import type { QuoteResponse } from "@/types/api";
import type { QuoteScenarioDetail } from "@/types/quote";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  isCustomerType,
} from "@/constants/customer-types";
import {
  QUOTE_DRAFT_STORAGE_PREFIX,
  type QuoteDraft,
  type QuotePdfRestoreState,
  saveQuotePdfRestore,
  readQuotePdfRestore,
} from "@/lib/quote-draft";

// ─── 상수 ────────────────────────────────────────────────
const CONTRACT_CATEGORIES = ["장기렌트", "리스"] as const;
const CONTRACT_MONTHS = [36, 48, 60] as const;
const ANNUAL_MILEAGES = [10000, 20000, 30000] as const;

type ContractCategory = (typeof CONTRACT_CATEGORIES)[number];
type ContractMonths = (typeof CONTRACT_MONTHS)[number];
type AnnualMileage = (typeof ANNUAL_MILEAGES)[number];

interface Conditions {
  contractMonths: ContractMonths;
  annualMileage: AnnualMileage;
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
  /** 전기차 보조금(안내용, 견적 미반영). null = 보조금 없음 */
  evSubsidy: number | null;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: TrimOption[];
  rules: TrimRule[];
  lineupId: string | null;
  lineup: { id: string; name: string } | null;
}

// ─── 조건 칩 ──────────────────────────────────────────────
function ConditionChip({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="inline-flex flex-col items-center rounded-[10px] border border-border-subtle bg-surface-soft px-3 py-1.5">
      {sub && <span className="mb-0.5 text-[9px] uppercase tracking-wider text-text-muted">{sub}</span>}
      <span className="text-[12px] font-bold leading-none text-text-strong">{label}</span>
    </div>
  );
}

// ─── 스텝 인디케이터 ──────────────────────────────────────
const STEPS = ["고객 유형", "조건 설정", "견적 확인"] as const;

function StepBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-7 rounded-card border border-border-subtle bg-surface p-4 shadow-card md:rounded-card-lg md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="public-quiet-label">견적 진행</span>
        <span className="text-[12px] font-bold text-brand">{currentStep} / {STEPS.length}</span>
      </div>
      <div className="flex items-center gap-2">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;
        return (
          <div key={step} className="min-w-0 flex-1">
            <div
                className={cn(
                  "h-1.5 rounded-full transition-colors duration-300",
                step <= currentStep ? "bg-brand" : "bg-border-subtle"
              )}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300",
                  isCompleted
                    ? "bg-brand text-surface"
                    : isActive
                    ? "bg-brand text-surface"
                    : "bg-surface-soft text-text-muted"
                )}
              >
                {isCompleted ? <Check size={11} strokeWidth={2.5} /> : step}
              </div>
              <span
                className={cn(
                  "truncate text-[11px]",
                  isActive ? "font-bold text-brand" : "text-text-muted"
                )}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
      </div>
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
        "min-h-[44px] rounded-[12px] border px-4 py-2.5 text-[14px] font-bold transition-all duration-150",
        selected
          ? "border-brand bg-brand text-surface"
          : "border-border-subtle bg-surface text-text-body hover:border-brand/30 hover:text-text-strong"
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
];

// ─── 메인 ────────────────────────────────────────────────
export function QuoteClientPage({ vehicles }: { vehicles: VehicleListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSlug = searchParams?.get("vehicle") ?? undefined;
  const customerTypeParam = searchParams?.get("customerType") ?? null;
  const initialCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;
  // 세션 id 는 마운트 시 1회만 생성 (렌더 중 crypto.randomUUID()/Date.now() 직접 호출 방지).
  const [quoteSessionId] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : `quote-${Date.now()}`
  );
  // 추천 결과에서 넘어온 TrimOption IDs (pre-select용)
  const prefillOptionIds = searchParams?.get("options")?.split(",").filter(Boolean) ?? [];

  // 카카오 로그인 후 견적 결과(step 3)로 복귀하기 위한 복원 플로우.
  // 저장본은 sessionStorage 라 SSR 에서 읽을 수 없으므로:
  //  - 초기 step 은 URL 마커(restore=1)로 서버·클라이언트가 동일하게 결정 → 하이드레이션 불일치 방지
  //  - 실제 데이터(견적결과/트림/옵션 등)는 마운트 후 effect 에서 sessionStorage 를 1회 소비해 채운다.
  const isRestoreReturn = searchParams?.get("restore") === "1";
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

  // 트림/옵션 상태
  const [trims, setTrims] = useState<TrimData[]>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  // 캐스케이딩 선택 상태
  const [selectedLineup, setSelectedLineup] = useState<string | null>(null);
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  // 색상 상태 — 차량별 외장/내장 색상 선택. 어드민이 등록한 색상이 있을 때만 노출.
  const [colors, setColors] = useState<VehicleColorPublic[]>([]);
  const [exteriorColorId, setExteriorColorId] = useState<string | null>(null);
  const [interiorColorId, setInteriorColorId] = useState<string | null>(null);

  const [contractCategory, setContractCategory] = useState<ContractCategory>("장기렌트");
  const [conditions, setConditions] = useState<Conditions>({
    contractMonths: 60,
    annualMileage: 20000,
  });
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  // 견적 확인 화면의 옵션 세부 내역(개별 옵션·색상 금액) 펼침 상태
  const [showOptionDetail, setShowOptionDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customRates, setCustomRates] = useState({ depositRate: 0, prepayRate: 0 });
  // 초기비용 패널(없음/있음) 펼침 상태 — 저장본에 담아 직전 화면 그대로 복원한다.
  const [costMode, setCostMode] = useState<CostMode>("none");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const baseStandardScenario = useRef<QuoteScenarioDetail | null>(null);
  const recalculateRequestId = useRef(0);
  // 직전 견적의 차량 slug — 같은 차량 재계산이면 초기비용 설정을 유지하기 위한 기준
  const lastQuotedSlug = useRef<string | null>(null);
  // 견적 재계산 직후 보존된 보증/선납 비율을 새 견적에 재적용해야 함을 표시
  const pendingRatesReapply = useRef(false);

  const handleContractApply = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 인증 후 복원할 수 있는 안전한 견적 초안만 영구 저장소에 남긴다.
    if (quoteResult) {
      const quoteDraft: QuoteDraft = {
        schemaVersion: 1,
        sessionId: quoteSessionId,
        vehicleSlug: quoteResult.vehicleSlug,
        trimId: quoteResult.trimId,
        selectedOptionIds: Array.from(selectedOptionIds),
        contractMonths: quoteResult.contractMonths,
        annualMileage: quoteResult.annualMileage,
        contractType: "반납형",
        productType: contractCategory,
        customerType,
        scenarios: quoteResult.scenarios,
        optionsTotalPrice: quoteResult.optionsTotalPrice,
        totalVehiclePrice: quoteResult.totalVehiclePrice,
        customRates: { depositRate: 0, prepayRate: 0 },
        exteriorColorId,
        interiorColorId,
      };
      localStorage.setItem(
        `${QUOTE_DRAFT_STORAGE_PREFIX}${quoteSessionId}`,
        JSON.stringify(quoteDraft)
      );
    }

    const target = `/verify?sessionId=${quoteSessionId}&vehicle=${selectedVehicle?.slug ?? ""}&customerType=${customerType}`;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  }, [
    router,
    quoteSessionId,
    selectedVehicle?.slug,
    quoteResult,
    customerType,
    selectedOptionIds,
    contractCategory,
    exteriorColorId,
    interiorColorId,
  ]);

  // 추천 프리필을 한 번만 적용하기 위한 플래그
  const hasPrefilled = useRef(false);

  // 차량 선택 시 트림 로드
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

    // 색상 로드 (병렬) — 어드민이 등록한 차량 색상이 있으면 외장/내장 기본값을 선택해둠
    fetch(`/api/vehicles/${slug}/colors`)
      .then((r) => r.json())
      .then((json) => {
        if (!json?.success || !Array.isArray(json.data)) return;
        const list: VehicleColorPublic[] = json.data;
        setColors(list);
        const defaultExt = list.find((c) => c.kind === "EXTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "EXTERIOR");
        const defaultInt = list.find((c) => c.kind === "INTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "INTERIOR");
        // 로그인 복귀 시에는 저장본의 색상을 우선 복원, 없으면 기본값.
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

        // 로그인 복귀(복원) 시: 저장본의 트림/옵션을 복원 — 프리필보다 우선한다.
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
          // 초기 선택도 일반 고객 주력 라인업 우선 — DB 기본 트림이 특수목적(택시 등)
          // 라인업이어도 첫 화면에는 정렬 최상단 라인업의 트림이 선택되게 한다.
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

  // 새로고침/뒤로/로그인 복귀 복원: 마운트 후 1회 localStorage 저장본을 읽어 견적 결과(step 3)를 복원한다.
  // (SSR 에서 접근 불가한 localStorage 를 effect 에서만 읽어 하이드레이션 불일치를 피한다.
  //  트림/옵션/색상은 위 trims·colors fetch 의 .then 에서 restoreRef 를 읽어 채운다.)
  useEffect(() => {
    if (!isRestoreReturn) return;
    const restored = readQuotePdfRestore();
    if (restored && restored.vehicleSlug === prefillSlug) {
      restoreRef.current = restored;
      // 가산 전 기준 시나리오(없으면 표시 중 standard) — reset 정확도용
      baseStandardScenario.current =
        restored.baseStandard ?? restored.quoteResult.scenarios.standard;
      setCustomerType(restored.customerType);
      setContractCategory(restored.contractCategory);
      setConditions({
        contractMonths: restored.conditions.contractMonths as ContractMonths,
        annualMileage: restored.conditions.annualMileage as AnnualMileage,
      });
      setCustomRates(restored.customRates);
      setCostMode(restored.costMode ?? "none");
      lastQuotedSlug.current = restored.vehicleSlug;
      setQuoteResult(restored.quoteResult);
      setStep(3);
    } else {
      // 저장본이 없으면(새로고침 등) 결과를 복원할 수 없으므로 조건 설정 단계로 폴백.
      setStep(initialCustomerType ? 2 : 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 캐스케이딩 파생 값 ──────────────────────────────────
  // 트림에 lineup 관계 또는 lineup 스펙이 있는지 확인
  const getLineupName = (t: TrimData): string =>
    t.lineup?.name ?? (t.specs as Record<string, string> | null)?.lineup ?? "";

  const hasCascade = trims.some((t) => getLineupName(t));

  // 1단계: 유니크 라인업 목록 (일반 주력 → 기타 → 특수목적 순)
  const availableLineups = hasCascade
    ? sortLineups([...new Set(trims.map((t) => getLineupName(t)).filter(Boolean))])
    : [];

  // 2단계: 선택된 라인업에 속하는 트림들
  const trimsForLineup = selectedLineup
    ? trims.filter((t) => getLineupName(t) === selectedLineup)
    : [];

  // 트림 옵션 (id 기반 — 같은 specs.trimName이 여러 개여도 정확히 식별)
  // 같은 라벨이 중복되면 t.name의 추가 prefix(연식/엔진/구동 등)를 보조 라벨로 구분.
  const availableTrimNames = (() => {
    const list = trimsForLineup.map((t) => {
      const trimName = (t.specs as Record<string, string>)?.trimName ?? t.name;
      const extra =
        t.name !== trimName && t.name.includes(trimName)
          ? t.name.replace(trimName, "").trim().replace(/\s+/g, " ")
          : null;
      return { id: t.id, name: trimName, extra, price: t.price, discountPrice: t.discountPrice };
    });
    // 같은 name이 여러 개면 보조 라벨 표시, 단일이면 보조 라벨 숨김
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

  // 최종 선택된 트림 객체 — id 기준 정확 매칭
  const selectedTrim =
    hasCascade
      ? (selectedTrimId ? trimsForLineup.find((t) => t.id === selectedTrimId) ?? null : null)
      : trims.find((t) => t.id === selectedLineup) ?? null;

  // 견적 API에 보낼 트림 id — selectedTrim에서 파생 (state selectedTrimId와는 별개의 derived value)
  const effectiveTrimId = selectedTrim?.id ?? null;

  const optionsTotalPrice = selectedTrim
    ? selectedTrim.options
        .filter((o) => selectedOptionIds.has(o.id))
        .reduce((sum, o) => sum + o.price, 0)
    : 0;

  const selectedExteriorColor = exteriorColorId ? colors.find((c) => c.id === exteriorColorId) ?? null : null;
  const selectedInteriorColor = interiorColorId ? colors.find((c) => c.id === interiorColorId) ?? null : null;
  const colorDelta = (selectedExteriorColor?.priceDelta ?? 0) + (selectedInteriorColor?.priceDelta ?? 0);

  // 선택한 옵션의 이름·개별 금액 — 견적 확인 화면 세부 내역과 PDF 에서 공용
  const selectedOptionDetails =
    selectedTrim?.options
      .filter((option) => selectedOptionIds.has(option.id))
      .map((option) => ({ id: option.id, name: option.name, price: option.price })) ?? [];

  // 견적 결과 복원용 저장본 생성 — 새로고침 직전의 화면을 그대로 복원하기 위해
  // 패널 펼침 상태(costMode), 보증/선납 비율(customRates), 표시 중인 견적(quoteResult)을 그대로 담고,
  // reset 정확도를 위해 가산 전 기준 시나리오(baseStandard)도 함께 저장한다.
  const buildRestoreState = (): QuotePdfRestoreState | null => {
    if (!quoteResult || !selectedVehicle) return null;
    return {
      vehicleSlug: selectedVehicle.slug,
      customerType,
      selectedLineup,
      selectedTrimName: selectedTrim?.name ?? null,
      selectedOptionIds: Array.from(selectedOptionIds),
      contractCategory,
      conditions: {
        contractMonths: conditions.contractMonths,
        annualMileage: conditions.annualMileage,
        contractType: "반납형",
      },
      customRates,
      exteriorColorId,
      interiorColorId,
      costMode,
      baseStandard: baseStandardScenario.current,
      quoteResult,
    };
  };

  // step 3 여부에 맞춰 URL 의 restore 마커를 동기화한다(remount 없이 history 만 갱신).
  // 마커가 있어야 새로고침 시 SSR 이 step 3 로 결정적으로 렌더되어 저장본을 복원할 수 있다.
  const syncRestoreMarker = (on: boolean) => {
    if (typeof window === "undefined" || !selectedVehicle) return;
    const params = new URLSearchParams(window.location.search);
    if ((params.get("restore") === "1") === on) return; // 변경 없으면 skip
    params.set("vehicle", selectedVehicle.slug);
    if (customerType) params.set("customerType", customerType);
    if (on) params.set("restore", "1");
    else params.delete("restore");
    window.history.replaceState(null, "", `/quote?${params.toString()}`);
  };

  // 비회원 게이트의 로그인 CTA: 저장본을 남긴 뒤 카카오 로그인으로 이동(restore 마커 포함).
  const handleGateLogin = () => {
    const state = buildRestoreState();
    if (state) saveQuotePdfRestore(state);
    const params = new URLSearchParams({
      vehicle: selectedVehicle?.slug ?? "",
      customerType,
      restore: "1",
    });
    router.push(`/login?next=${encodeURIComponent(`/quote?${params.toString()}`)}`);
  };

  // 견적 결과(step 3)에 도달하면 저장본을 localStorage 에 남기고 URL 에 restore 마커를 더한다.
  // → 새로고침/뒤로가기에도 결과가 유지된다(추천 결과 freeze 와 동일한 결).
  useEffect(() => {
    if (step === 3 && quoteResult && selectedVehicle) {
      const state = buildRestoreState();
      if (state) saveQuotePdfRestore(state);
      syncRestoreMarker(true);
    } else if (step !== 3) {
      syncRestoreMarker(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, quoteResult, costMode, customRates]);

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
            trimId: effectiveTrimId ?? undefined,
            selectedOptionIds: Array.from(selectedOptionIds),
            contractMonths: conditions.contractMonths,
            annualMileage: conditions.annualMileage,
            contractType: "반납형",
            productType: contractCategory,
            customerType,
            exteriorColorId,
            interiorColorId,
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

      // 같은 차량의 재계산('이전'으로 돌아갔다 다시 계산)이면 초기비용 설정을 유지하고
      // 새 기준 견적 위에 재적용한다. 다른 차량이면 닫힘 상태로 초기화.
      const preserveRates =
        lastQuotedSlug.current === selectedVehicle.slug &&
        (customRates.depositRate !== 0 || customRates.prepayRate !== 0);
      if (preserveRates) {
        pendingRatesReapply.current = true;
      } else {
        setCustomRates({ depositRate: 0, prepayRate: 0 });
        setCostMode("none"); // 새 견적은 초기비용 패널 닫힘으로 시작
      }
      lastQuotedSlug.current = selectedVehicle.slug;
      setShowOptionDetail(false); // 옵션 세부 내역은 접힘으로 시작
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
          trimId: effectiveTrimId ?? undefined,
          selectedOptionIds: Array.from(selectedOptionIds),
          contractMonths: conditions.contractMonths,
          annualMileage: conditions.annualMileage,
          contractType: "반납형",
          productType: contractCategory,
          customDepositRate: rates.depositRate,
          customPrepayRate: rates.prepayRate,
          customerType,
          exteriorColorId,
          interiorColorId,
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

  // 같은 차량 재계산 직후: 유지된 보증/선납 비율을 새 기준 견적에 재적용한다.
  // (customRates 가 변하지 않아 위 디바운스 effect 가 발화하지 않으므로 별도 처리)
  // customRates 를 deps 에 포함해 항상 최신 비율로 호출 — 중복 발화는 ref 플래그가 막는다.
  useEffect(() => {
    if (!pendingRatesReapply.current || !quoteResult) return;
    pendingRatesReapply.current = false;
    recalculateStandard(customRates);
  // recalculateStandard 는 매 렌더 재생성되는 일반 함수라 의도적으로 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteResult, customRates]);

  async function handlePdfDownload() {
    if (!quoteResult || !selectedVehicle) return;

    setIsPdfDownloading(true);
    setPdfError(null);

    const selectedOptions = selectedOptionDetails.map(({ name, price }) => ({ name, price }));

    const payload: Partial<PDFQuoteData> = {
      vehicleName: selectedVehicle.name,
      vehicleBrand: selectedVehicle.brand,
      trimName: quoteResult.trimName,
      trimPrice: quoteResult.trimPrice,
      selectedOptions,
      totalVehiclePrice:
        quoteResult.totalVehiclePrice ??
        quoteResult.trimPrice + (quoteResult.optionsTotalPrice ?? optionsTotalPrice) + colorDelta,
      productType: contractCategory,
      contractMonths: quoteResult.contractMonths,
      annualMileage: quoteResult.annualMileage,
      contractType: "반납형",
      scenarios: quoteResult.scenarios,
      exteriorColor: selectedExteriorColor
        ? {
            name: selectedExteriorColor.name,
            hexCode: selectedExteriorColor.hexCode,
            priceDelta: selectedExteriorColor.priceDelta,
          }
        : null,
      interiorColor: selectedInteriorColor
        ? {
            name: selectedInteriorColor.name,
            hexCode: selectedInteriorColor.hexCode,
            priceDelta: selectedInteriorColor.priceDelta,
          }
        : null,
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

  const stepTitle =
    step === 1 ? "견적내기" : step === 2 ? "조건 설정" : "견적 결과";
  const stepDescription =
    step === 1
      ? "고객 유형을 선택하면 조건 설정으로 이어집니다."
      : step === 2
      ? "트림과 계약 조건을 선택해 월 납입금을 계산합니다."
      : "월 납입금과 신청 전 조건을 확인하세요.";

  return (
    <div className="public-app-page min-h-screen pb-[104px] md:pb-0">
      {/* 앱형 페이지 헤더 */}
      <div className="border-b border-border-subtle bg-surface">
        <div className="page-container py-3.5 md:py-10">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5">
                <Calculator size={13} className="text-brand" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-public-muted">
                  실시간 견적
                </span>
              </div>
              <h1 className="truncate text-[20px] font-extrabold leading-tight text-text-strong md:text-[34px] md:font-extrabold">
                {stepTitle}
              </h1>
              <p className="mt-1 text-[12px] leading-relaxed text-text-body md:text-[15px]">
                {stepDescription}
              </p>
            </div>
            {selectedVehicle && (
              <div className="hidden shrink-0 rounded-full border border-brand/15 bg-brand-soft px-3 py-1.5 text-[12px] font-bold text-brand sm:block">
                {selectedVehicle.name}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-container py-4 md:py-8">
        <div className="mx-auto max-w-5xl">
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
                <div className="public-mobile-section mb-4 max-w-full overflow-hidden p-5 md:rounded-[24px] md:p-7">
                  <h2 className="mb-1.5 text-[19px] font-extrabold leading-tight text-text-strong md:text-[21px]">
                    계약할 고객 유형을 선택하세요
                  </h2>
                  <p className="mb-4 text-[12px] leading-relaxed text-text-body md:text-[13px]">
                    선택한 유형은 견적 저장과 계약 신청 서류 확인에 사용됩니다.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {CUSTOMER_TYPE_OPTIONS.map((option) => {
                      const selected = customerType === option.type;
                      return (
                        <button
                          key={option.type}
                          type="button"
                          onClick={() => setCustomerType(option.type)}
                          className={cn(
                            "flex min-h-[74px] items-center gap-3 rounded-card border px-4 py-3 text-left transition-all duration-150 md:min-h-[86px]",
                            selected
                              ? "border-brand bg-brand-soft"
                              : "border-border-subtle bg-surface hover:border-brand/30 hover:bg-surface-soft"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                              selected
                                ? "bg-brand text-surface"
                                : "bg-surface-soft text-text-body"
                            )}
                          >
                            {option.icon}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block text-[14px] font-bold",
                                selected ? "text-brand" : "text-text-strong"
                              )}
                            >
                              {CUSTOMER_TYPE_LABELS[option.type]}
                            </span>
                            <span className="mt-1 block text-[12px] leading-relaxed text-text-muted">
                              {option.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="hidden items-center justify-between md:flex">
                  <button
                    type="button"
                    onClick={() => router.push("/cars")}
                    className="inline-flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-text-strong"
                  >
                    <ChevronLeft size={15} />
                    차량 탐색으로 돌아가기
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-btn bg-brand px-6 py-3 text-[14px] font-bold text-surface transition-all duration-200 hover:bg-brand-dark"
                  >
                    조건 설정하기
                    <Calculator size={15} />
                  </button>
                </div>

                <div className="public-fixed-action">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="public-touch-button w-full bg-brand text-surface"
                  >
                    조건 설정하기
                    <Calculator size={16} />
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
                <div className="public-mobile-section mb-4 overflow-hidden md:rounded-[24px] md:p-7">
                  <div className="flex justify-center pt-3 md:hidden">
                    <span className="h-1 w-10 rounded-full bg-border-strong" />
                  </div>
                  {/* 선택된 차량 요약 */}
                  {selectedVehicle && (
                    <div className="mx-4 mb-5 mt-3 flex items-center gap-3 rounded-card border border-brand/15 bg-brand-soft p-3.5 md:mx-0 md:mt-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand shadow-soft">
                        <Check size={14} className="text-surface" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-public-muted">
                          선택된 차량
                        </p>
                        <p className="text-[15px] font-bold text-brand">
                          {selectedVehicle.name}
                        </p>
                        <p className="text-[12px] text-ink-caption mt-0.5">
                          고객 유형: {CUSTOMER_TYPE_LABELS[customerType]}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="ml-auto shrink-0 rounded-full border border-brand/15 bg-surface px-3 py-1.5 text-[12px] font-bold text-text-muted transition-colors hover:text-brand"
                      >
                        유형 변경
                      </button>
                    </div>
                  )}

                  {/* ── 캐스케이딩 트림 선택 ── */}
                  <div className="px-4 md:px-0">
                  {trimsLoading ? (
                    <div className="mb-5 flex h-11 items-center gap-2 text-[13px] text-public-muted">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-subtle border-t-brand" />
                      트림 정보 불러오는 중...
                    </div>
                  ) : trims.length > 0 ? (
                    <div className="mb-5 space-y-3">

                      <LineupTrimPicker
                        hasCascade={hasCascade}
                        lineups={lineupChoices}
                        selectedLineup={selectedLineup}
                        onLineupChange={(lineup) => {
                          setSelectedLineup(lineup);
                          setSelectedOptionIds(new Set());
                        }}
                        trims={hasCascade ? cascadeTrimChoices : flatTrimChoices}
                        selectedTrimId={hasCascade ? selectedTrimId : selectedLineup}
                        onTrimChange={(trimId) => {
                          if (hasCascade) {
                            setSelectedTrimId(trimId);
                          } else {
                            setSelectedLineup(trimId);
                          }
                          setSelectedOptionIds(new Set());
                        }}
                      />

                      {/* 추가 옵션 — 아코디언 설명 포함 */}
                      {selectedTrim && selectedTrim.options.length > 0 && (
                        <div className="space-y-2.5">
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-semibold text-ink">
                                추가 옵션
                              </p>
                              <p className="mt-0.5 text-[11px] text-public-muted">
                                필요한 옵션만 선택하면 차량가에 바로 반영됩니다
                              </p>
                            </div>
                            <span className="shrink-0 rounded-full bg-public-bg px-2.5 py-1 text-[11px] font-semibold text-public-muted">
                              {selectedOptionIds.size}/{selectedTrim.options.length}개 선택
                            </span>
                          </div>

                          <div
                            className={cn(
                              "rounded-card border px-3.5 py-3 transition-colors",
                              selectedOptionIds.size > 0
                                ? "border-brand/20 bg-brand/[0.04]"
                                : "border-public-border bg-public-bg"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-public-muted">
                                  선택 옵션 요약
                                </p>
                                {selectedOptionIds.size > 0 ? (
                                  <p className="mt-1 text-[13px] font-semibold text-ink">
                                    {selectedOptionIds.size}개 선택 · +{Math.round(optionsTotalPrice / 10000).toLocaleString()}만원
                                  </p>
                                ) : (
                                  <p className="mt-1 text-[13px] text-ink-label">
                                    아직 선택한 옵션이 없습니다
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] text-public-muted">예상 차량가</p>
                                <p className="mt-0.5 num text-[14px] font-extrabold text-brand tabular-nums">
                                  {Math.round((selectedTrim.price + optionsTotalPrice) / 10000).toLocaleString()}만원
                                </p>
                              </div>
                            </div>
                            {selectedOptionDetails.length > 0 && (
                              <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
                                {selectedOptionDetails.slice(0, 4).map((option) => (
                                  <span
                                    key={option.id}
                                  className="shrink-0 rounded-full border border-brand/15 bg-surface px-2.5 py-1 text-[11px] font-bold text-brand"
                                  >
                                    {option.name}
                                  </span>
                                ))}
                                {selectedOptionDetails.length > 4 && (
                                  <span className="shrink-0 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted">
                                    +{selectedOptionDetails.length - 4}개
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="overflow-hidden rounded-[16px] border border-border-subtle divide-y divide-border-subtle shadow-card">
                            {selectedTrim.options.map((opt) => {
                              const isOptSelected = selectedOptionIds.has(opt.id);
                              const isExpanded = expandedOptionId === opt.id;
                              const hasDesc = !!opt.description;

                              const toggleSelect = () => {
                                const rules = selectedTrim?.rules ?? [];
                                setSelectedOptionIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(opt.id)) {
                                    next.delete(opt.id);
                                  } else {
                                    next.add(opt.id);
                                    for (const rule of rules) {
                                      if (rule.sourceOptionId === opt.id &&
                                        (rule.ruleType === "REQUIRED" || rule.ruleType === "INCLUDED")) {
                                        next.add(rule.targetOptionId);
                                      }
                                    }
                                    for (const rule of rules) {
                                      if (rule.sourceOptionId === opt.id && rule.ruleType === "CONFLICT") {
                                        next.delete(rule.targetOptionId);
                                      }
                                    }
                                  }
                                  return next;
                                });
                              };

                              return (
                                <div
                                  key={opt.id}
                                  className={cn(
                                    "transition-colors duration-100",
                                    isOptSelected ? "bg-brand-soft" : "bg-surface"
                                  )}
                                >
                                  {/* 메인 행: 체크박스 + 이름 + 가격 + 설명 토글 */}
                                  <div className="flex min-h-[54px] items-center gap-3 px-4 py-2.5">
                                    {/* 체크박스 */}
                                    <button
                                      type="button"
                                      onClick={toggleSelect}
                                      className="shrink-0"
                                    >
                                      <div className={cn(
                                        "w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-colors",
                                        isOptSelected ? "border-brand bg-brand" : "border-border-strong bg-surface"
                                      )}>
                                        {isOptSelected && <Check size={9} strokeWidth={3} className="text-surface" />}
                                      </div>
                                    </button>

                                    {/* 옵션명 (클릭 시 선택) + 추천 배지 */}
                                    <button
                                      type="button"
                                      onClick={toggleSelect}
                                      className={cn(
                                        "flex-1 text-[13px] text-left flex items-center gap-1.5 flex-wrap",
                                        isOptSelected ? "text-brand font-bold" : "text-ink"
                                      )}
                                    >
                                      <span>{opt.name}</span>
                                      {opt.badge && (
                                        <span className="inline-flex shrink-0 items-center rounded-[4px] bg-surface px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand">
                                          {opt.badge}
                                        </span>
                                      )}
                                    </button>

                                    {/* 가격 */}
                                    <span className={cn(
                                      "text-[12px] font-bold shrink-0",
                                      isOptSelected ? "text-brand" : "text-ink-label"
                                    )}>
                                      +{opt.price >= 10000
                                        ? `${Math.round(opt.price / 10000).toLocaleString()}만원`
                                        : `${opt.price.toLocaleString()}원`}
                                    </span>

                                    {/* 설명 토글 버튼 */}
                                    {hasDesc && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedOptionId(isExpanded ? null : opt.id)}
                                        className="shrink-0 rounded-md p-1 transition-colors hover:bg-surface-soft"
                                        aria-label="설명 보기"
                                      >
                                        <ChevronDown
                                          size={14}
                                          className={cn(
                                            "text-ink-caption transition-transform duration-200",
                                            isExpanded && "rotate-180"
                                          )}
                                        />
                                      </button>
                                    )}
                                  </div>

                                  {/* 아코디언 설명 */}
                                  <AnimatePresence>
                                    {isExpanded && hasDesc && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                      >
                                        <p className="border-t border-border-subtle px-11 pb-3 pt-2.5 text-[12px] leading-relaxed text-text-body">
                                          {opt.description}
                                        </p>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 색상 선택 — 어드민이 등록한 색상이 있을 때만 노출 */}
                      {selectedTrim && colors.length > 0 && (
                        <ColorSelector
                          colors={colors}
                          exteriorColorId={exteriorColorId}
                          interiorColorId={interiorColorId}
                          onChange={(kind, id) => {
                            if (kind === "EXTERIOR") setExteriorColorId(id);
                            else setInteriorColorId(id);
                          }}
                        />
                      )}

                      {/* 선택된 트림 가격 요약 */}
                      {selectedTrim && (
                        <div className="flex flex-col gap-2 rounded-[16px] border border-public-border bg-public-bg px-3.5 py-3.5 text-[12px] sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-ink-caption">
                            {selectedTrim.engineType}
                            {selectedTrim.fuelEfficiency ? ` · 연비 ${selectedTrim.fuelEfficiency}km/L` : ""}
                          </span>
                          <div className="flex items-center gap-2">
                            {selectedTrim.discountPrice && (
                                <span className="text-[10px] font-semibold text-status-danger line-through">
                                {Math.round(selectedTrim.price / 10000).toLocaleString()}만원
                              </span>
                            )}
                            <span className="num font-extrabold text-ink">
                              차량가 {Math.round(((selectedTrim.discountPrice ?? selectedTrim.price) + optionsTotalPrice + colorDelta) / 10000).toLocaleString()}만원
                            </span>
                            {selectedTrim.discountPrice && (
                              <span className="rounded-[4px] bg-status-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-status-danger">
                                -{Math.round((selectedTrim.price - selectedTrim.discountPrice) / 10000).toLocaleString()}만원 할인
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 전기차 보조금 안내 (견적 미반영, 표시 전용) */}
                      {selectedTrim && (
                        <EvSubsidyNotice amount={selectedTrim.evSubsidy} />
                      )}
                    </div>
                  ) : null}
                  </div>

                  {/* 구분선 */}
                  {selectedTrim && <div className="mx-4 mb-5 border-t border-public-border md:mx-0" />}

                  <div className="px-4 md:px-0">
                    <h2 className="mb-5 text-[19px] font-semibold leading-tight text-ink md:text-[17px] md:font-medium">
                      계약 조건을 설정하세요
                    </h2>

                  {/* ① 상품 유형 */}
                  <div className="mb-6">
                    <p className="mb-1.5 text-[13px] font-semibold text-ink">
                      상품 유형
                    </p>
                    <p className="mb-3 text-[12px] leading-relaxed text-public-muted">
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
                    <div className="mb-6 flex items-start gap-2 rounded-[12px] border border-public-border bg-public-bg p-4 text-[13px] leading-relaxed text-public-muted">
                      <p>리스 견적은 임시 데이터 기준입니다. 실제 금융사 조건과 다를 수 있습니다.</p>
                    </div>
                  )}

                  {(contractCategory === "장기렌트" || contractCategory === "리스") && (
                    <>
                      {/* ② 계약기간 */}
                      <div className="mb-6">
                        <p className="mb-3 text-[13px] font-semibold text-ink">
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
                        <p className="mb-3 text-[13px] font-semibold text-ink">
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

                    </>
                  )}
                  </div>
                </div>

                {/* 안내 메시지 */}
                <div className="mb-4 flex items-start gap-2 rounded-[14px] border border-border-subtle bg-surface p-4 text-[13px] leading-relaxed text-text-body shadow-card">
                  <p>
                    초기 비용 없음·초기 비용 있음 2가지
                    시나리오를 한 번에 확인할 수 있습니다.
                  </p>
                </div>

                {/* 에러 */}
                {error && (
                  <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-status-danger/20 bg-status-danger-soft p-4 text-[13px] text-status-danger">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">견적 데이터를 불러올 수 없습니다</p>
                      <p className="mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                {/* 버튼 */}
                <div className="hidden items-center justify-between md:flex">
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
                      "inline-flex items-center gap-2 px-6 py-3 rounded-btn text-[14px] font-bold transition-all duration-200",
                      isLoading || !selectedTrim
                        ? "cursor-not-allowed bg-border-subtle text-text-muted"
                        : "bg-brand text-surface hover:bg-brand-dark"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        계산 중...
                      </>
                    ) : (
                      <>
                        {selectedTrim ? "월 납입금 확인하기" : "트림을 선택하세요"}
                        <Calculator size={15} />
                      </>
                    )}
                  </button>
                </div>
                <div className="public-fixed-action">
                  <button
                    type="button"
                    disabled={isLoading || !selectedTrim}
                    onClick={fetchQuote}
                    className={cn(
                      "public-touch-button w-full gap-2",
                      isLoading || !selectedTrim
                        ? "bg-border-subtle text-text-muted"
                        : "bg-brand text-surface"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        계산 중...
                      </>
                    ) : (
                      <>
                        {selectedTrim ? "월 납입금 확인하기" : "트림을 선택하세요"}
                        <Calculator size={16} />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {/* 로그인 복귀 직후, 저장본에서 견적을 복원하는 동안의 짧은 로딩 */}
            {step === 3 && !quoteResult && isRestoreReturn && (
              <motion.div
                key="step3-restoring"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-3"
              >
                <span className="inline-block w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] text-ink-label">견적 정보를 불러오는 중…</p>
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
                {/* ── 차량 + 조건 요약 배너 ── */}
                <div className="public-mobile-section mb-4 overflow-hidden md:rounded-[24px]">
                  {/* 좌우 2분할: 왼쪽 차량 이미지 / 오른쪽 정보·조건 */}
                  <div className="flex flex-col sm:flex-row">
                    {/* 좌: 차량 이미지 (여백 두고 배치) */}
                    <div className="hidden w-full shrink-0 border-b border-border-subtle bg-surface-soft p-3 sm:flex sm:w-1/2 sm:border-b-0 sm:border-r md:p-4">
                      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[12px] bg-surface-soft sm:aspect-auto sm:min-h-[180px]">
                        {selectedVehicle?.thumbnailUrl ? (
                          <Image
                            src={selectedVehicle.thumbnailUrl}
                            alt={selectedVehicle.name ?? "차량"}
                            fill
                            sizes="(max-width: 640px) 100vw, 50vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[12px] text-text-muted">
                            이미지 준비 중
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 우: 차량 정보 + 조건 칩 (절반) */}
                    <div className="flex flex-1 flex-col min-w-0 sm:w-1/2">
                      <div className="flex items-start gap-3 px-4 py-3.5 md:px-6 md:py-5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-ink-caption uppercase tracking-wider mb-0.5">
                            {selectedVehicle?.brand}
                          </p>
                          <p className="text-[15px] font-semibold text-ink truncate leading-snug">
                            {selectedVehicle?.name}
                          </p>
                          {hasCascade && selectedLineup && (
                            <p
                              title={selectedLineup}
                              className="text-[11px] text-ink-caption mt-0.5 truncate"
                            >
                              {selectedLineup}
                            </p>
                          )}
                          {quoteResult.trimName && (
                            <p className="text-[12px] text-ink-label mt-0.5 truncate">
                              {quoteResult.trimName}
                            </p>
                          )}
                          <p className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[11px] text-ink-caption">기본 차량가</span>
                            <span className="text-[13px] font-semibold text-ink tabular-nums">
                              {(quoteResult.discountPrice ?? quoteResult.trimPrice).toLocaleString()}원
                            </span>
                            {quoteResult.discountPrice != null &&
                              quoteResult.discountPrice < quoteResult.trimPrice && (
                                <span className="text-[11px] text-ink-caption line-through tabular-nums">
                                  {quoteResult.trimPrice.toLocaleString()}원
                                </span>
                              )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { goToStep(2); setQuoteResult(null); setError(null); }}
                          className="flex shrink-0 items-center gap-1 rounded-[10px] border border-border-subtle px-3 py-2 text-[12px] font-bold text-text-body transition-all duration-150 hover:border-brand/40 hover:text-brand"
                        >
                          <ChevronLeft size={13} />
                          이전
                        </button>
                      </div>

                      {/* 조건 칩 */}
                      <div className="flex flex-wrap items-center gap-2 px-4 pb-3.5 md:px-6 mt-auto">
                        <ConditionChip label={`${quoteResult.contractMonths}개월`} sub="계약기간" />
                        <ConditionChip label={`연 ${(quoteResult.annualMileage / 10000).toFixed(0)}만km`} sub="약정거리" />
                        {quoteResult.optionsTotalPrice || selectedExteriorColor || selectedInteriorColor ? (
                          <button
                            type="button"
                            onClick={() => setShowOptionDetail((v) => !v)}
                            aria-expanded={showOptionDetail}
                            className={cn(
                              "inline-flex flex-col items-center rounded-[8px] px-3 py-1.5 border transition-colors duration-150",
                              showOptionDetail
                                ? "bg-brand-soft border-brand/30"
                                : "border-border-subtle bg-surface-soft hover:border-brand/40"
                            )}
                          >
                            <span className="text-[9px] text-ink-caption uppercase tracking-wider mb-0.5">
                              구성 상세
                            </span>
                            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink leading-none">
                              {quoteResult.optionsTotalPrice
                                ? `옵션 +${Math.round((quoteResult.optionsTotalPrice ?? 0) / 10000).toLocaleString()}만원`
                                : "옵션·색상"}
                              <ChevronDown
                                size={11}
                                className={cn(
                                  "text-ink-caption transition-transform duration-200",
                                  showOptionDetail && "rotate-180"
                                )}
                              />
                            </span>
                          </button>
                        ) : null}
                        <ConditionChip label={CUSTOMER_TYPE_LABELS[customerType]} sub="고객 유형" />
                      </div>
                    </div>
                  </div>

                  {/* 옵션·색상 세부 내역 펼침 패널 */}
                  <AnimatePresence initial={false}>
                    {showOptionDetail &&
                    (quoteResult.optionsTotalPrice || selectedExteriorColor || selectedInteriorColor) ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1.5 border-t border-public-border px-4 py-3">
                          {selectedOptionDetails.map((o) => (
                            <div
                              key={o.id}
                              className="flex items-baseline justify-between gap-3 text-[12px]"
                            >
                              <span className="text-ink-label truncate">{o.name}</span>
                              <span className="font-medium text-ink shrink-0 tabular-nums">
                                {o.price > 0 ? `+${o.price.toLocaleString()}원` : "무상"}
                              </span>
                            </div>
                          ))}
                          {selectedExteriorColor && (
                            <div className="flex items-baseline justify-between gap-3 text-[12px]">
                              <span className="text-ink-label truncate">
                                외장 색상 · {selectedExteriorColor.name}
                              </span>
                              <span className="font-medium text-ink shrink-0 tabular-nums">
                                {selectedExteriorColor.priceDelta > 0
                                  ? `+${selectedExteriorColor.priceDelta.toLocaleString()}원`
                                  : "기본"}
                              </span>
                            </div>
                          )}
                          {selectedInteriorColor && (
                            <div className="flex items-baseline justify-between gap-3 text-[12px]">
                              <span className="text-ink-label truncate">
                                내장 색상 · {selectedInteriorColor.name}
                              </span>
                              <span className="font-medium text-ink shrink-0 tabular-nums">
                                {selectedInteriorColor.priceDelta > 0
                                  ? `+${selectedInteriorColor.priceDelta.toLocaleString()}원`
                                  : "기본"}
                              </span>
                            </div>
                          )}
                          <div className="!mt-2.5 flex items-baseline justify-between gap-3 border-t border-dashed border-border-subtle pt-2.5 text-[12px]">
                            <span className="text-ink-caption">
                              총 차량가 (기본 + 옵션 + 색상)
                            </span>
                            <span className="num font-extrabold text-brand tabular-nums">
                              {(
                                quoteResult.totalVehiclePrice ??
                                (quoteResult.discountPrice ?? quoteResult.trimPrice) +
                                  (quoteResult.optionsTotalPrice ?? 0) +
                                  (quoteResult.colorDelta ?? 0)
                              ).toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                {/* 전기차 보조금 안내 (견적 미반영, 표시 전용) */}
                {selectedTrim?.evSubsidy ? (
                  <div className="mb-4">
                    <EvSubsidyNotice amount={selectedTrim.evSubsidy} />
                  </div>
                ) : null}

                {/* 견적 결과 또는 별도 상담 안내 */}
                {quoteResult.requiresConsultation ? (
                  <div className="public-mobile-section mb-4 p-5 md:p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                        <AlertCircle size={20} className="text-brand" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-ink leading-snug">
                          이 차량은 별도 상담이 필요합니다
                        </p>
                        <p className="text-[13px] text-ink-label mt-1 leading-relaxed">
                          현재 자동 견적에 필요한 회수율 데이터가 등록되지 않아
                          정확한 금액을 즉시 산출하기 어렵습니다. 전문 상담을 통해
                          맞춤 견적을 받아보실 수 있습니다.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-[12px] border border-border-subtle bg-surface-soft p-3 text-[12px] leading-relaxed text-text-muted">
                      옵션·계약조건에 따라 캐피탈사별 금액이 크게 달라질 수 있어
                      상담을 통한 견적이 더 정확합니다.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="public-mobile-section mb-4 p-4 md:p-6">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2">
                        <p className="text-[13px] text-ink-label">
                          초기 비용 여부에 따라 월 납입금이 달라집니다
                        </p>
                        </div>
                        <span className="hidden sm:inline-flex rounded-full bg-public-bg px-2.5 py-1 text-[11px] font-semibold text-public-muted">
                          실시간 재계산
                        </span>
                      </div>
                      <QuoteBreakdownTabs
                        scenarios={quoteResult.scenarios}
                        customerType={customerType}
                        customRates={customRates}
                        onCustomRatesChange={setCustomRates}
                        isRecalculating={isRecalculating}
                        onMemberLogin={handleGateLogin}
                        costMode={costMode}
                        onCostModeChange={setCostMode}
                        onReset={() => {
                          setCustomRates({ depositRate: 0, prepayRate: 0 });
                          restoreBaseStandardScenario();
                        }}
                      />
                      {quoteResult.scenarios?.standard?.rangeExceeded && (
                        <div className="mt-4 flex items-start gap-2 rounded-[12px] border border-status-warning/25 bg-status-warning-soft px-3 py-2.5 text-[12px] leading-relaxed text-status-warning">
                          <AlertCircle size={13} className="shrink-0 mt-0.5" />
                          <p>
                            선택하신 옵션 조합으로 차량가가 등록 회수율 범위를 초과해 참고용 견적으로 표시됩니다.
                            정확한 금액은 상담을 통해 확인해 주세요.
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedVehicle && (
                      <ComparisonSection
                        primary={{
                          slug: selectedVehicle.slug,
                          brand: selectedVehicle.brand,
                          name: selectedVehicle.name,
                          result: quoteResult,
                          // 비교 패널에 필요한 추가 정보
                          thumbnailUrl: selectedVehicle.thumbnailUrl,
                          trims: trims,
                          currentTrimId: effectiveTrimId,
                          currentOptionIds: selectedOptionIds,
                        }}
                        conditions={{
                          contractMonths: conditions.contractMonths,
                          annualMileage: conditions.annualMileage,
                          contractType: "반납형",
                          productType: contractCategory,
                        }}
                        allVehicles={vehicles}
                        onMemberLogin={handleGateLogin}
                      />
                    )}
                  </>
                )}

                {/* 면책 안내 */}
                <div className="mb-4 rounded-[16px] border border-border-subtle bg-surface p-4 text-[12px] leading-relaxed text-text-muted shadow-card">
                  위 견적은 실제 계약 가능한 기준으로 계산되었으나, 최종 금액은
                  차량 상태·옵션·프로모션에 따라 달라질 수 있습니다. 전문가
                  상담을 통해 확정 견적을 받으시길 권장합니다.
                </div>

                <div className="public-mobile-section mb-4 p-4 md:rounded-[24px] md:p-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand/65">
                        다음 단계
                      </p>
                      <p className="mt-0.5 text-[15px] font-semibold text-ink">
                        조건을 확인한 뒤 심사로 이어가세요
                      </p>
                    </div>
                    <div className="shrink-0 rounded-full bg-status-warning-soft px-2.5 py-1 text-[11px] font-semibold text-status-warning shadow-sm">
                      연락처 입력 전 상담 가능
                    </div>
                  </div>

                  {/* 계약 신청하기 */}
                  <button
                    type="button"
                    onClick={handleContractApply}
                    className="public-touch-button mb-2.5 w-full gap-2 bg-brand text-surface shadow-lift hover:bg-brand-dark"
                  >
                    <ClipboardCheck size={16} strokeWidth={2.2} />
                    이 조건으로 심사 요청하기
                  </button>

                  {/* 견적서 카카오톡으로 받기 */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePdfDownload}
                      disabled={isPdfDownloading}
                      className={cn(
                        "public-touch-button min-h-[46px] w-full gap-1.5 border px-3 text-[13px] font-bold",
                        isPdfDownloading
                          ? "cursor-not-allowed border-border-subtle bg-surface-soft text-text-muted"
                          : "border-brand/20 bg-surface text-brand hover:bg-brand-soft active:scale-[0.98]"
                      )}
                    >
                      {isPdfDownloading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                          준비 중
                        </>
                      ) : (
                        <>
                          <Download size={14} strokeWidth={2.2} />
                          견적서 받기
                        </>
                      )}
                    </button>

                    {/* 상담 버튼 */}
                    <ChannelTalkButton
                      vehicleName={selectedVehicle?.name}
                      label="상담하기"
                      className="min-h-[46px] rounded-[12px] border border-border-subtle bg-surface px-3 py-0 text-[13px] font-semibold text-text-body hover:bg-surface-soft hover:opacity-100"
                    />
                  </div>

                  {pdfError && (
                    <div className="mt-2 flex items-start gap-2 rounded-[12px] border border-status-danger/20 bg-status-danger-soft p-3 text-[12px] text-status-danger">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <p>{pdfError}</p>
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-[12px] bg-surface-soft px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-public-muted">
                      <Check size={12} className="text-brand" />
                      개인정보 입력 전 상담 가능
                    </p>
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-public-muted">
                      <Check size={12} className="text-brand" />
                      최종 조건 상담 후 확정
                    </p>
                  </div>
                </div>

                {/* 하단 링크 */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
	                  <button
	                    type="button"
	                    onClick={() => router.push("/cars")}
	                    className="inline-flex min-h-10 items-center gap-1.5 text-left text-[13px] text-ink-caption transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/35"
	                  >
	                    <ChevronLeft size={14} aria-hidden />
	                    다른 차량 계산하기
	                  </button>
	                  <Link
	                    href={`/cars/${selectedVehicle?.slug}`}
	                    className="ml-auto inline-flex min-h-10 items-center gap-1.5 text-[13px] text-brand transition-colors hover:text-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/35"
	                  >
	                    차량 상세 보기
	                    <ChevronRight size={14} aria-hidden />
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
