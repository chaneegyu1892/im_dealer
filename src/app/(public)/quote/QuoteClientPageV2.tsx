"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { z } from "zod";
import {
  ChevronLeft,
  BriefcaseBusiness,
  Building2,
  User,
  Check,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startKakaoLogin } from "@/lib/kakao/client-auth";
import { isKakaoSyncEnabled } from "@/lib/kakao/scopes";
import { cn } from "@/lib/utils";
import { isSupabaseStorageUrl } from "@/lib/image-url";
import { sortLineups } from "@/lib/lineup-sort";
import { productTypeLabel } from "@/constants/product-type";
import { TossPrice } from "@/components/ui/TossPrice";
import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { QuoteResultActions } from "@/components/quote/QuoteResultActions";
import {
  openChannelTalkWithQuote,
  trackQuoteDeliveryRequested,
  trackQuoteDeliverySent,
  type ChannelTalkQuoteContext,
} from "@/lib/channel-talk";
import { kakaoChannelChatUrl } from "@/lib/kakao/channel-add";
import { QuoteDeliveryGuideModal } from "@/components/quote/QuoteDeliveryGuideModal";
import { LoginRequiredModal } from "@/components/quote/LoginRequiredModal";
import { ComparisonSection } from "@/components/quote/ComparisonSection";
import { type ComparisonTrimData } from "@/components/quote/VehicleConfigPanel";
import { EvSubsidyNotice } from "@/components/quote/EvSubsidyNotice";
import {
  CUSTOMER_TYPE_LABELS,
  type CustomerType,
  isCustomerType,
} from "@/constants/customer-types";
import type { VehicleListItem, QuoteResponse } from "@/types/api";
import type { QuoteScenarioDetail } from "@/types/quote";
import { deriveQuoteScenarioType } from "@/lib/quote-scenario-selection";
import { successfulCalculatedQuoteResponseSchema } from "@/lib/quote-response-schema";
import {
  applySavedQuoteAmountsToDisplay,
  savedQuoteResponseSchema,
} from "@/lib/saved-quote-client";
import type { VehicleColorPublic } from "@/components/quote/ColorSelector";
import {
  type LineupChoice,
  type TrimChoice,
} from "@/components/quote/LineupTrimPicker";
import {
  QUOTE_DRAFT_STORAGE_PREFIX,
  readQuoteImageRestore,
  saveQuoteImageRestore,
  type QuoteImageRestoreState,
  type QuoteDraft,
} from "@/lib/quote-draft";
import { Step2ConditionV2, type TrimDataV2 } from "./Step2ConditionV2";
import { InitialCostPanelV2, type CostMode } from "./InitialCostPanelV2";
import {
  ApprovalPreviewV2,
  FinanceSectionV2,
  CostCheckpointV2,
} from "./QuoteInfoSectionsV2";
import {
  DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE,
  PUBLIC_CARD_QUOTE_CONDITION,
} from "@/constants/quote-defaults";
import { useTracking } from "@/lib/use-tracking";

// ─── 상수 ────────────────────────────────────────────────
const STEPS = ["고객 유형", "조건 설정", "견적 확인"] as const;

// 견적서 받기 로그인 게이트 → 로그인 후 복귀 시 요청 흐름을 이어가기 위한 URL 표식.
const DELIVERY_RESUME_PARAM = "deliver";

// 게이트 로그인 왕복 동안 견적 세션 ID 를 보관하는 localStorage 키.
// 복귀 마운트에서 같은 세션을 이어받아야 계산 로그(QuoteCalcLog) → 게이트 이벤트
// (ExplorationLog) → 전환(clickedApply)이 한 세션 기준으로 조인된다.
const DELIVERY_GATE_SESSION_KEY = "imd_delivery_gate_session";

const apiErrorSchema = z.object({
  error: z.string().optional(),
  code: z.string().optional(),
});

function hasLockedQuoteScenario(quote: QuoteResponse): boolean {
  return (
    quote.scenarios.conservative.locked === true ||
    quote.scenarios.standard.locked === true ||
    quote.scenarios.aggressive.locked === true
  );
}

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
  evSubsidy: number | null;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: TrimOption[];
  rules: TrimRule[];
  lineupId: string | null;
  lineup: { id: string; name: string } | null;
  availableProducts: ("장기렌트" | "리스")[];
}

// ════════════════════════════════════════════════════════════
// 메인 — v2 (2회차: STEP 2 탭 + 실제 API 연동)
// ════════════════════════════════════════════════════════════
export function QuoteClientPageV2({ vehicles }: { vehicles: VehicleListItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillSlug = searchParams?.get("vehicle") ?? undefined;
  const prefillTrimId = searchParams?.get("trim") ?? undefined;
  const customerTypeParam = searchParams?.get("customerType") ?? null;
  const initialCustomerType = isCustomerType(customerTypeParam) ? customerTypeParam : null;
  const isRestoreReturn = searchParams?.get("restore") === "1";
  // 로그인 게이트를 통과하고 돌아왔다는 표식 — 견적서 요청 흐름을 1회 자동 재개한다.
  const isDeliveryResumeReturn = searchParams?.get(DELIVERY_RESUME_PARAM) === "1";
  const prefillOptionsParam = searchParams?.get("options") ?? "";
  const productTypeParam = searchParams?.get("productType");
  const initialProductType = productTypeParam === "리스"
    ? "리스"
    : DEFAULT_PUBLIC_QUOTE_PRODUCT_TYPE;
  const contractMonthsParam = Number(searchParams?.get("contractMonths"));
  const initialContractMonths = [36, 48, 60].includes(contractMonthsParam)
    ? contractMonthsParam
    : PUBLIC_CARD_QUOTE_CONDITION.contractMonths;
  const annualMileageParam = Number(searchParams?.get("annualMileage"));
  const initialAnnualMileage = [10_000, 20_000, 30_000].includes(annualMileageParam)
    ? annualMileageParam
    : PUBLIC_CARD_QUOTE_CONDITION.annualMileage;
  const draftSource = searchParams?.get("source") === "AI" ? "AI" : "DETAIL" as const;

  const [quoteSessionId] = useState(() => {
    // 게이트 로그인 복귀(deliver=1)면 직전 견적 세션을 이어받는다.
    // 매 마운트마다 새 UUID 를 만들면 OAuth 왕복을 기준으로 퍼널이 끊긴다.
    if (isDeliveryResumeReturn && typeof window !== "undefined") {
      const pending = window.localStorage.getItem(DELIVERY_GATE_SESSION_KEY);
      if (pending) {
        window.localStorage.removeItem(DELIVERY_GATE_SESSION_KEY);
        return pending;
      }
    }
    return typeof crypto !== "undefined" ? crypto.randomUUID() : `quote-${Date.now()}`;
  });
  const { track } = useTracking();
  // 게이트 표시 이벤트는 마운트당 1회만 — 모달을 닫았다 다시 여는 반복이 카운트를 부풀리지 않게.
  const deliveryGateShownTracked = useRef(false);

  const restoreRef = useRef<QuoteImageRestoreState | null>(null);

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
  const [trimsLoaded, setTrimsLoaded] = useState(false);
  const [colorsLoaded, setColorsLoaded] = useState(false);
  const [trimsError, setTrimsError] = useState(false);
  const [selectedLineup, setSelectedLineup] = useState<string | null>(null);
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [colors, setColors] = useState<VehicleColorPublic[]>([]);
  const [exteriorColorId, setExteriorColorId] = useState<string | null>(null);
  const [interiorColorId, setInteriorColorId] = useState<string | null>(null);

  const [contractCategory, setContractCategory] = useState<"장기렌트" | "리스">(initialProductType);
  const [conditions, setConditions] = useState<{ contractMonths: number; annualMileage: number }>({
    contractMonths: initialContractMonths,
    annualMileage: initialAnnualMileage,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [isConsultationSubmitting, setIsConsultationSubmitting] = useState(false);
  const [consultationError, setConsultationError] = useState<string | null>(null);

  // ─── 보증금/선납/CTA 상태 (v1 계약 그대로) ─────────────
  const [customRates, setCustomRates] = useState({ depositRate: 0, prepayRate: 0 });
  const [costMode, setCostMode] = useState<CostMode>("none");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliverSuccess, setDeliverSuccess] = useState(false);
  // 클립보드에 복사한 견적 요청 메시지. 모달을 닫은 뒤에도 '대화창 다시 열기'에서 재복사하므로
  // 모달 열림 상태(deliveryGuideOpen)와 분리해 보관한다.
  const [deliveryRequestMessage, setDeliveryRequestMessage] = useState<string | null>(null);
  const [deliveryGuideOpen, setDeliveryGuideOpen] = useState(false);
  // 웹은 고객이 실제로 대화창에서 전송했는지 알 수 없다 — '보냈어요' 자가 확인으로 받는다.
  const [deliveryConfirmedBySender, setDeliveryConfirmedBySender] = useState(false);
  const [deliveryTrackContext, setDeliveryTrackContext] =
    useState<ChannelTalkQuoteContext | null>(null);
  // 견적서 받기 로그인 게이트 — 비회원이 눌렀을 때 노출한다.
  const [deliveryLoginGateOpen, setDeliveryLoginGateOpen] = useState(false);
  // 카카오톡 '나에게 보내기' 자동발송은 카카오싱크 + 명시적 자동발송 플래그가 모두 켜졌을 때만.
  // (KAKAO_SYNC 는 간편가입 로그인용이라, 자동발송과는 분리한다.)
  const kakaoDeliveryEnabled =
    isKakaoSyncEnabled() && process.env.NEXT_PUBLIC_KAKAO_QUOTE_AUTO_SEND === "true";
  // 비즈톡 자동발송 전 기본 임시방편: '견적서 받기' → 카카오 채널추가 유도 →
  // 채널톡(↔카카오 채널 통합)으로 상담사가 확인 후 견적서를 수동 발송한다.
  const channelTalkDelivery = !kakaoDeliveryEnabled;
  const baseStandardScenario = useRef<QuoteScenarioDetail | null>(null);
  const recalculateRequestId = useRef(0);
  const lastQuotedSlug = useRef<string | null>(null);
  const pendingRatesReapply = useRef(false);
  const pendingRecalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recalcInFlightRef = useRef<Promise<void> | null>(null);
  const recalculateStandardRef = useRef<(
    rates: { depositRate: number; prepayRate: number }
  ) => Promise<void>>(async () => {});

  const hasPrefilled = useRef(false);

  // ─── 트림/색상 fetch (v1 계약 그대로 + 에러 복구) ──────
  const loadVehicleDetails = useCallback(() => {
    if (!selectedVehicle) return;
    const slug = selectedVehicle.slug;
    setTrimsLoading(true);
    setTrimsLoaded(false);
    setTrimsError(false);
    setTrims([]);
    setSelectedLineup(null);
    setSelectedTrimId(null);
    setSelectedOptionIds(new Set());
    setColors([]);
    setColorsLoaded(false);
    setExteriorColorId(null);
    setInteriorColorId(null);

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
        setColorsLoaded(true);
      })
      .catch(() => {});

    fetch(`/api/vehicles/${slug}/trims`)
      .then((r) => r.json())
      .then((trimsJson) => {
        if (!trimsJson?.success || !Array.isArray(trimsJson.data)) return;
        const loadedTrims: TrimData[] = trimsJson.data;
        setTrimsLoaded(true);
        if (loadedTrims.length === 0) return;
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
        } else if (prefillTrimId && !hasPrefilled.current) {
          hasPrefilled.current = true;
          const lineupNameOf = (t: TrimData): string =>
            t.lineup?.name ?? (t.specs as Record<string, string> | null)?.lineup ?? "";
          const hasLineup = loadedTrims.some((t) => lineupNameOf(t));
          const recommendedTrim = loadedTrims.find((t) => t.id === prefillTrimId);
          if (!recommendedTrim) return;
          const resolvedLineupName = lineupNameOf(recommendedTrim);
          if (hasLineup && resolvedLineupName) {
            setSelectedLineup(resolvedLineupName);
            setSelectedTrimId(recommendedTrim.id);
          } else {
            setSelectedLineup(recommendedTrim.id);
          }
          const prefillOptionIds = prefillOptionsParam.split(",").filter(Boolean);
          if (prefillOptionIds.length > 0) {
            const validIds = new Set(recommendedTrim.options.map((o: TrimOption) => o.id));
            const toSelect = prefillOptionIds.filter((id) => validIds.has(id));
            if (toSelect.length > 0) setSelectedOptionIds(new Set(toSelect));
          }
        }
      })
      .catch(() => {
        // 트림 로딩 실패 시 데드엔드 방지: 에러 상태를 설정해 재시도 UI 노출.
        setTrimsError(true);
      })
      .finally(() => setTrimsLoading(false));
  }, [selectedVehicle, prefillOptionsParam, prefillTrimId]);

  useEffect(() => {
    loadVehicleDetails();
  }, [loadVehicleDetails]);

  // ─── 복원 (v1 계약 그대로) ─────────────────────────────
  useEffect(() => {
    if (!isRestoreReturn) return;
    const restored = readQuoteImageRestore();
    if (restored && restored.vehicleSlug === prefillSlug) {
      restoreRef.current = restored;
      baseStandardScenario.current =
        restored.baseStandard ?? restored.quoteResult.scenarios.standard;
      setCustomerType(restored.customerType);
      setContractCategory(restored.contractCategory);
      setConditions({
        contractMonths: restored.conditions.contractMonths,
        annualMileage: restored.conditions.annualMileage,
      });
      setCustomRates(restored.customRates);
      setCostMode(restored.costMode ?? "none");
      lastQuotedSlug.current = restored.vehicleSlug;
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
  const canRequestConsultation = trimsLoaded && trims.length === 0;

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
    if (!selectedVehicle || (!selectedTrim && !canRequestConsultation)) return;
    setIsLoading(true);
    setError(null);
    try {
      const requestBody = {
        sessionId: quoteSessionId,
        selectedOptionIds: selectedTrim ? Array.from(selectedOptionIds) : [],
        contractMonths: conditions.contractMonths,
        annualMileage: conditions.annualMileage,
        contractType: "반납형",
        productType: contractCategory,
        customerType,
        exteriorColorId: selectedTrim ? exteriorColorId : null,
        interiorColorId: selectedTrim ? interiorColorId : null,
        ...(selectedTrim ? { trimId: selectedTrim.id } : {}),
      };
      const res = await fetch(`/api/vehicles/${selectedVehicle.slug}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "견적 계산에 실패했습니다.");
        return;
      }
      const nextResult = json.data as QuoteResponse;
      recalculateRequestId.current += 1;
      baseStandardScenario.current = nextResult.scenarios.standard ?? null;

      // 같은 차량 재계산이면 초기비용 설정 유지, 다른 차량이면 초기화 (v1 계약)
      const preserveRates =
        lastQuotedSlug.current === selectedVehicle.slug &&
        (customRates.depositRate !== 0 || customRates.prepayRate !== 0);
      if (preserveRates) {
        pendingRatesReapply.current = true;
      } else {
        setCustomRates({ depositRate: 0, prepayRate: 0 });
        setCostMode("none");
      }
      lastQuotedSlug.current = selectedVehicle.slug;
      setQuoteResult(nextResult);
      goToStep(3);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  // 복원 직후 트림 목록이 로드되기 전에는 state가 비어 있다 —
  // 저장/재계산 모두 복원 스냅샷의 옵션을 써야 같은 조건으로 계산된다.
  const getEffectiveSelectedOptionIds = useCallback((): string[] => {
    const currentOptionIds = Array.from(selectedOptionIds);
    const restored = restoreRef.current;
    if (
      trimsLoaded ||
      !restored ||
      restored.vehicleSlug !== quoteResult?.vehicleSlug
    ) {
      return currentOptionIds;
    }
    return [...restored.selectedOptionIds];
  }, [quoteResult?.vehicleSlug, selectedOptionIds, trimsLoaded]);

  // 색상도 같은 문제가 있다 — 색상 목록 로드 전에는 state가 null이라
  // 복원된 색상 선택이 저장/재계산에서 빠질 수 있다.
  const getEffectiveSelectedColorIds = useCallback((): {
    exteriorColorId: string | null;
    interiorColorId: string | null;
  } => {
    const restored = restoreRef.current;
    if (
      colorsLoaded ||
      !restored ||
      restored.vehicleSlug !== quoteResult?.vehicleSlug
    ) {
      return { exteriorColorId, interiorColorId };
    }
    return {
      exteriorColorId: restored.exteriorColorId ?? null,
      interiorColorId: restored.interiorColorId ?? null,
    };
  }, [quoteResult?.vehicleSlug, exteriorColorId, interiorColorId, colorsLoaded]);

  // ─── 보증금/선납 재계산 (v1 계약 그대로) ───────────────
  async function recalculateStandard(rates: { depositRate: number; prepayRate: number }) {
    const run = (async () => {
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
            sessionId: quoteSessionId,
            trimId: selectedTrim?.id ?? quoteResult.trimId,
            selectedOptionIds: getEffectiveSelectedOptionIds(),
            contractMonths: conditions.contractMonths,
            annualMileage: conditions.annualMileage,
            contractType: "반납형",
            productType: contractCategory,
            customDepositRate: rates.depositRate,
            customPrepayRate: rates.prepayRate,
            customerType,
            ...getEffectiveSelectedColorIds(),
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          console.error("[recalculateStandard]", json?.error ?? "failed");
          return;
        }
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
    })();
    recalcInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (recalcInFlightRef.current === run) {
        recalcInFlightRef.current = null;
      }
    }
  }
  recalculateStandardRef.current = recalculateStandard;

  const restoreBaseStandardScenario = useCallback(() => {
    recalculateRequestId.current += 1;
    setIsRecalculating(false);
    const standard = baseStandardScenario.current;
    if (!standard) return;
    setQuoteResult((prev) =>
      prev ? { ...prev, scenarios: { ...prev.scenarios, standard } } : prev
    );
  }, []);

  // 슬라이더 변경 시 500ms 디바운스 재계산 (v1 계약 그대로)
  useEffect(() => {
    if (!quoteResult || !selectedVehicle) return;
    const rates = customRates;
    const handle = setTimeout(() => {
      if (pendingRecalcTimerRef.current === handle) {
        pendingRecalcTimerRef.current = null;
      }
      void recalculateStandardRef.current(rates);
    }, 500);
    pendingRecalcTimerRef.current = handle;
    return () => {
      clearTimeout(handle);
      if (pendingRecalcTimerRef.current === handle) {
        pendingRecalcTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customRates.depositRate, customRates.prepayRate]);

  // 같은 차량 재계산 직후 보존된 비율 재적용 (v1 계약 그대로)
  useEffect(() => {
    if (!pendingRatesReapply.current || !quoteResult) return;
    pendingRatesReapply.current = false;
    recalculateStandard(customRates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteResult, customRates]);

  const flushPendingQuoteRecalculation = useCallback(async () => {
    const pendingTimer = pendingRecalcTimerRef.current;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingRecalcTimerRef.current = null;
    }
    if (recalcInFlightRef.current) {
      await recalcInFlightRef.current;
    }
    if (pendingTimer) {
      await recalculateStandardRef.current(customRates);
    }
  }, [customRates]);

  const saveCurrentQuote = useCallback(async () => {
    if (!quoteResult?.trimId) {
      throw new Error("상담 요청을 저장하려면 트림을 선택해 주세요.");
    }

    await flushPendingQuoteRecalculation();

    const saveRes = await fetch("/api/quote/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: quoteSessionId,
        vehicleSlug: quoteResult.vehicleSlug,
        trimId: quoteResult.trimId,
        selectedOptionIds: getEffectiveSelectedOptionIds(),
        contractMonths: quoteResult.contractMonths,
        annualMileage: quoteResult.annualMileage,
        contractType: "반납형",
        customerType,
        productType: contractCategory,
        scenarioType: deriveQuoteScenarioType(customRates),
        customDepositRate: customRates.depositRate,
        customPrepayRate: customRates.prepayRate,
        ...getEffectiveSelectedColorIds(),
        quoteType: draftSource,
      }),
    });
    const responsePayload: unknown = await saveRes.json().catch(() => null);
    const savedQuoteResult = savedQuoteResponseSchema.safeParse(responsePayload);
    if (!saveRes.ok || !savedQuoteResult.success) {
      const apiErrorResult = apiErrorSchema.safeParse(responsePayload);
      throw new Error(
        apiErrorResult.success && apiErrorResult.data.error
          ? apiErrorResult.data.error
          : "견적 저장에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    }
    const savedQuote = savedQuoteResult.data.data;
    setQuoteResult((prev) =>
      prev ? applySavedQuoteAmountsToDisplay(prev, savedQuote) : prev
    );
    return savedQuote;
  }, [
    quoteResult,
    quoteSessionId,
    getEffectiveSelectedOptionIds,
    customerType,
    contractCategory,
    customRates,
    getEffectiveSelectedColorIds,
    draftSource,
    flushPendingQuoteRecalculation,
  ]);

  const handleConsultationRequest = useCallback(async () => {
    if (!quoteResult || isConsultationSubmitting) return;
    setIsConsultationSubmitting(true);
    setConsultationError(null);
    try {
      const savedQuote = await saveCurrentQuote();
      const opened = openChannelTalkWithQuote({
        quoteId: savedQuote.id,
        sessionId: savedQuote.sessionId,
        vehicleName: selectedVehicle?.name ?? "",
        trimName: quoteResult.trimName,
        productType: contractCategory,
        contractMonths: quoteResult.contractMonths,
        annualMileage: quoteResult.annualMileage,
      });
      if (!opened) {
        setConsultationError("상담창을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
    } catch (saveError) {
      setConsultationError(
        saveError instanceof Error
          ? saveError.message
          : "상담 요청 저장에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setIsConsultationSubmitting(false);
    }
  }, [
    quoteResult,
    isConsultationSubmitting,
    saveCurrentQuote,
    selectedVehicle,
    contractCategory,
  ]);

  // ─── 견적 초안 저장 + /verify 이동 (v1 계약 그대로) ────
  const handleContractApply = useCallback(async () => {
    if (!quoteResult || isApplying) return;
    setIsApplying(true);
    try {
      const quoteDraft: QuoteDraft = {
        schemaVersion: 1,
        sessionId: quoteSessionId,
        vehicleSlug: quoteResult.vehicleSlug,
        trimId: quoteResult.trimId,
        selectedOptionIds: getEffectiveSelectedOptionIds(),
        contractMonths: quoteResult.contractMonths,
        annualMileage: quoteResult.annualMileage,
        contractType: "반납형",
        productType: contractCategory,
        customerType,
        scenarios: quoteResult.scenarios,
        optionsTotalPrice: quoteResult.optionsTotalPrice,
        totalVehiclePrice: quoteResult.totalVehiclePrice,
        customRates,
        ...getEffectiveSelectedColorIds(),
        source: draftSource,
      };
      localStorage.setItem(
        `${QUOTE_DRAFT_STORAGE_PREFIX}${quoteSessionId}`,
        JSON.stringify(quoteDraft)
      );

      setError(null);
      try {
        await saveCurrentQuote();
      } catch {
        setError("견적 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const target = `/verify?sessionId=${quoteSessionId}&vehicle=${selectedVehicle?.slug ?? ""}&customerType=${customerType}`;
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(target)}`);
        return;
      }
      router.push(target);
    } finally {
      setIsApplying(false);
    }
  }, [
    router, quoteSessionId, selectedVehicle?.slug, quoteResult, customerType,
    getEffectiveSelectedOptionIds, getEffectiveSelectedColorIds, contractCategory, customRates, draftSource,
    isApplying, saveCurrentQuote,
  ]);

  // ─── 카카오톡으로 견적서 전송 ─────────────────────────────
  async function handleQuoteDeliver() {
    if (!kakaoDeliveryEnabled || !quoteResult) return;
    setIsDelivering(true);
    setDeliveryError(null);
    setDeliverSuccess(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        await startKakaoConsentFlow();
        return;
      }

      if (hasLockedQuoteScenario(quoteResult)) {
        await refreshQuoteForDelivery();
      }

      const savedQuote = await saveCurrentQuote();
      const response = await fetch("/api/quote/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savedQuoteId: savedQuote.id,
          sessionId: savedQuote.sessionId,
        }),
      });
      const responsePayload: unknown = await response.json().catch(() => null);
      const apiErrorResult = apiErrorSchema.safeParse(responsePayload);

      if (!response.ok) {
        if (
          response.status === 401 ||
          (apiErrorResult.success &&
            apiErrorResult.data.code === "KAKAO_REAUTH_REQUIRED")
        ) {
          await startKakaoConsentFlow();
          return;
        }
        setDeliveryError(
          apiErrorResult.success && apiErrorResult.data.error
            ? apiErrorResult.data.error
            : "카카오톡 전송에 실패했습니다."
        );
        return;
      }

      setDeliverSuccess(true);
    } catch (deliverError) {
      if (!(deliverError instanceof Error)) throw deliverError;
      setDeliveryError(
        deliverError.message ||
          "전송 중 네트워크 오류가 발생했습니다."
      );
    } finally {
      setIsDelivering(false);
    }
  }

  // ─── 임시방편: 견적서 받기 → 안내 모달 → 카카오 채널 대화창 (비즈톡 자동발송 전) ───
  // ① 견적 저장 + 채널톡 track(상담사용 컨텍스트) + 요청 메시지 클립보드 복사
  // ② 안내 모달을 띄워 "복사했어요, 붙여넣어 보내주세요"를 이동 전에 반드시 읽게 한다.
  // ③ 모달 CTA 클릭 시(handleDeliveryGuideConfirm) 대화창을 연다 — 클릭 직후 동기
  //    실행이라 팝업 차단에 안 걸린다. 여기서 바로 열면 await 뒤라 차단되어
  //    고객이 채널 홈에 떨어진다(채널추가 팝업만 열리던 기존 문제).
  async function handleQuoteReceiveViaChannelTalk() {
    if (!quoteResult || isDelivering) return;
    if (!kakaoChannelChatUrl()) {
      setDeliveryError("카카오 채널 설정을 확인해 주세요. 잠시 후 다시 시도해주세요.");
      return;
    }
    // 견적서 수령은 회원 전용 — 비회원이면 저장·복사 전에 로그인 게이트로 보낸다.
    if (!(await hasActiveSession())) {
      setDeliveryError(null);
      setDeliverSuccess(false);
      setDeliveryLoginGateOpen(true);
      // 게이트 정책 재검토용 퍼널: 견적 세션 ID 로 기록해 QuoteCalcLog 와 조인 가능하게 한다.
      if (!deliveryGateShownTracked.current) {
        deliveryGateShownTracked.current = true;
        void track("delivery_gate_shown", {
          sessionId: quoteSessionId,
          vehicleId: selectedVehicle?.id,
          metadata: { vehicleSlug: selectedVehicle?.slug },
        });
      }
      return;
    }
    setIsDelivering(true);
    setDeliveryError(null);
    setDeliverSuccess(false);
    setDeliveryConfirmedBySender(false);

    try {
      const savedQuote = await saveCurrentQuote();
      const vehicleName = selectedVehicle?.name ?? "";
      // 상담사가 채널톡 데스크에서 볼 견적 요청 컨텍스트를 기록.
      const deliveryContext: ChannelTalkQuoteContext = {
        quoteId: savedQuote.id,
        sessionId: savedQuote.sessionId,
        vehicleName,
        trimName: quoteResult.trimName,
        productType: contractCategory,
        contractMonths: quoteResult.contractMonths,
        annualMileage: quoteResult.annualMileage,
      };
      trackQuoteDeliveryRequested(deliveryContext);
      setDeliveryTrackContext(deliveryContext);

      // 채널 대화창은 메시지 프리필이 불가하므로, 견적 정보가 담긴 요청 메시지를
      // 클립보드에 복사해 고객이 대화창에 붙여넣고 보내도록 유도한다(상담사가 견적 파악).
      const requestSubject = [vehicleName, quoteResult.trimName].filter(Boolean).join(" ");
      const deliveryMessage =
        `[견적서 요청] ${requestSubject}\n` +
        `${productTypeLabel(contractCategory)} · ${quoteResult.contractMonths}개월 · 연 ${quoteResult.annualMileage.toLocaleString()}km\n` +
        `견적서 보내주세요.`;
      try {
        await navigator.clipboard?.writeText(deliveryMessage);
      } catch {
        // 클립보드 권한/미지원 — 모달 CTA 클릭 시 한 번 더 복사한다.
      }

      setDeliveryRequestMessage(deliveryMessage);
      setDeliveryGuideOpen(true);
    } catch (deliverError) {
      setDeliveryError(
        deliverError instanceof Error
          ? deliverError.message
          : "견적서 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setIsDelivering(false);
    }
  }

  // 세션 조회 실패는 "로그인 안 됨"으로 간주한다 — 인증 오류가 게이트를 뚫으면 안 된다.
  async function hasActiveSession(): Promise<boolean> {
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      return Boolean(user);
    } catch (sessionError) {
      if (!(sessionError instanceof Error)) throw sessionError;
      return false;
    }
  }

  // 로그인 게이트 CTA — 견적 상태를 보관하고, 복귀 후 이어갈 표식과 함께 카카오 로그인으로.
  async function handleDeliveryLoginGateConfirm() {
    // 클릭 자체가 의도 신호 — 로그인 시작 성공 여부와 무관하게 기록한다.
    void track("delivery_gate_login_click", {
      sessionId: quoteSessionId,
      vehicleId: selectedVehicle?.id,
      metadata: { vehicleSlug: selectedVehicle?.slug },
    });
    // OAuth 왕복 뒤에도 같은 견적 세션으로 이어지도록 보관해 둔다.
    window.localStorage.setItem(DELIVERY_GATE_SESSION_KEY, quoteSessionId);
    const state = buildRestoreState();
    if (state) {
      restoreRef.current = state;
      saveQuoteImageRestore(state);
    }
    setDeliveryLoginGateOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set("restore", "1");
    params.set(DELIVERY_RESUME_PARAM, "1");
    try {
      await startKakaoLogin({ next: `${window.location.pathname}?${params.toString()}` });
    } catch (loginError) {
      if (!(loginError instanceof Error)) throw loginError;
      setDeliveryError("로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  // 안내 모달 CTA — 클릭 직후 동기적으로 대화창을 열어야 팝업 차단에 안 걸린다.
  function handleDeliveryGuideConfirm() {
    if (!openChannelChatWithMessage()) return;
    setDeliveryGuideOpen(false);
    setDeliverSuccess(true);
  }

  // '보냈어요' — 고객 자가 확인. 상담사 데스크에도 남겨 미전송 건과 구분되게 한다.
  function handleConfirmChannelSent() {
    setDeliveryConfirmedBySender(true);
    if (deliveryTrackContext) trackQuoteDeliverySent(deliveryTrackContext);
  }

  // '대화창 다시 열기' — 창을 닫았거나 붙여넣기를 놓친 고객이 되돌아갈 길.
  function handleReopenChannelChat() {
    openChannelChatWithMessage();
  }

  // 요청 문구를 다시 복사하고 대화창을 연다. 클릭 핸들러에서 동기 호출해야 팝업 차단을 피한다.
  function openChannelChatWithMessage(): boolean {
    const chatUrl = kakaoChannelChatUrl();
    if (!chatUrl) {
      setDeliveryGuideOpen(false);
      setDeliveryError("카카오 채널 설정을 확인해 주세요. 잠시 후 다시 시도해주세요.");
      return false;
    }
    // 앞선 복사의 사용자 활성화가 만료됐을 수 있어(Safari 등) 새 제스처에서 한 번 더 복사.
    if (deliveryRequestMessage) {
      try {
        navigator.clipboard?.writeText(deliveryRequestMessage).catch(() => {});
      } catch {
        // 복사 실패해도 대화창은 연다.
      }
    }
    window.open(chatUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  async function refreshQuoteForDelivery(): Promise<QuoteResponse> {
    const baseQuote = await requestCalculatedQuoteForDelivery({
      depositRate: 0,
      prepayRate: 0,
    });
    baseStandardScenario.current = baseQuote.scenarios.standard;

    const refreshedQuote =
      customRates.depositRate > 0 || customRates.prepayRate > 0
        ? await requestCalculatedQuoteForDelivery(customRates)
        : baseQuote;

    if (hasLockedQuoteScenario(refreshedQuote)) {
      throw new Error(
        "로그인 정보가 견적에 반영되지 않았습니다. 새로고침 후 다시 시도해 주세요."
      );
    }

    recalculateRequestId.current += 1;
    setQuoteResult(refreshedQuote);
    return refreshedQuote;
  }

  async function requestCalculatedQuoteForDelivery(rates: {
    readonly depositRate: number;
    readonly prepayRate: number;
  }): Promise<QuoteResponse> {
    if (!selectedVehicle || !quoteResult?.trimId) {
      throw new Error("전송할 견적 정보를 확인할 수 없습니다.");
    }

    const response = await fetch(
      `/api/vehicles/${selectedVehicle.slug}/quote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: quoteSessionId,
          trimId: quoteResult.trimId,
          selectedOptionIds: getEffectiveSelectedOptionIds(),
          contractMonths: quoteResult.contractMonths,
          annualMileage: quoteResult.annualMileage,
          contractType: "반납형",
          productType: contractCategory,
          customerType,
          ...getEffectiveSelectedColorIds(),
          ...(rates.depositRate > 0
            ? { customDepositRate: rates.depositRate }
            : {}),
          ...(rates.prepayRate > 0
            ? { customPrepayRate: rates.prepayRate }
            : {}),
        }),
      }
    );
    const responsePayload: unknown = await response.json().catch(() => null);
    const parsed = successfulCalculatedQuoteResponseSchema.safeParse(
      responsePayload
    );
    if (!response.ok || !parsed.success) {
      const apiErrorResult = apiErrorSchema.safeParse(responsePayload);
      throw new Error(
        apiErrorResult.success && apiErrorResult.data.error
          ? apiErrorResult.data.error
          : "로그인 후 견적을 다시 계산하지 못했습니다."
      );
    }
    return parsed.data.data;
  }

  // ─── 복원 저장본 생성 + 게이트 로그인 (v1 계약 그대로) ──
  const buildRestoreState = useCallback((): QuoteImageRestoreState | null => {
    if (!quoteResult || !selectedVehicle) return null;
    return {
      vehicleSlug: selectedVehicle.slug,
      customerType,
      selectedLineup,
      selectedTrimName: selectedTrim?.name ?? null,
      selectedOptionIds: getEffectiveSelectedOptionIds(),
      contractCategory,
      conditions: {
        contractMonths: conditions.contractMonths,
        annualMileage: conditions.annualMileage,
        contractType: "반납형",
      },
      customRates,
      ...getEffectiveSelectedColorIds(),
      costMode,
      baseStandard: baseStandardScenario.current,
      quoteResult,
    };
  }, [quoteResult, selectedVehicle, customerType, selectedLineup, selectedTrim, getEffectiveSelectedOptionIds, getEffectiveSelectedColorIds, contractCategory, conditions, customRates, costMode]);

  async function startKakaoConsentFlow(): Promise<void> {
    const state = buildRestoreState();
    if (state) {
      restoreRef.current = state;
      saveQuoteImageRestore(state);
    }
    const next = `${window.location.pathname}${window.location.search}`;
    await startKakaoLogin({ next });
  }

  const handleGateLogin = useCallback(() => {
    const state = buildRestoreState();
    if (state) {
      restoreRef.current = state;
      saveQuoteImageRestore(state);
    }
    const params = new URLSearchParams({
      vehicle: selectedVehicle?.slug ?? "",
      customerType,
      restore: "1",
    });
    if (draftSource === "AI") params.set("source", "AI");
    router.push(`/login?next=${encodeURIComponent(`/quote?${params.toString()}`)}`);
  }, [buildRestoreState, router, selectedVehicle, customerType, draftSource]);

  // 결과(step 3) 도달 시 저장본 localStorage 저장 + restore 마커 동기화 (v1 계약)
  useEffect(() => {
    if (step === 3 && quoteResult && selectedVehicle) {
      const state = buildRestoreState();
      if (state) {
        restoreRef.current = state;
        saveQuoteImageRestore(state);
      }
      // restore 마커 동기화
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        params.set("vehicle", selectedVehicle.slug);
        if (customerType) params.set("customerType", customerType);
        params.set("restore", "1");
        window.history.replaceState(null, "", `/quote?${params.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, quoteResult, costMode, customRates]);

  // ─── 로그인 게이트 복귀 → 견적서 요청 흐름 1회 자동 재개 ─────
  // 대화창은 여기서 열지 않는다. 페이지 로드 직후의 window.open 은 팝업 차단에 걸리므로,
  // 안내 모달까지만 띄우고 대화창은 모달 CTA(사용자 제스처)로 연다.
  const deliveryResumeHandled = useRef(false);
  useEffect(() => {
    if (!channelTalkDelivery || !isDeliveryResumeReturn) return;
    if (deliveryResumeHandled.current) return;
    if (step !== 3 || !quoteResult) return;
    deliveryResumeHandled.current = true;

    // 표식 제거 — 새로고침으로 다시 실행되지 않게 한다.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete(DELIVERY_RESUME_PARAM);
      window.history.replaceState(null, "", `/quote?${params.toString()}`);
    }

    void (async () => {
      // 로그인이 끝나지 않았다면 조용히 넘어간다. 버튼을 다시 누르면 게이트가 다시 뜬다.
      if (!(await hasActiveSession())) return;
      await handleQuoteReceiveViaChannelTalk();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelTalkDelivery, isDeliveryResumeReturn, step, quoteResult]);

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
        availableProducts: selectedTrim.availableProducts,
      }
    : null;

  const stepLabel = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-app-bg pb-[calc(148px+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="sticky top-14 z-40 border-b border-border-subtle bg-surface/95 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center gap-3 px-5 max-[340px]:px-3">
          <button
            type="button"
            onClick={() => {
              // 딥링크/공유로 직접 진입한 경우(history 없음) router.back()이 사이트를 떠나지 않도록 폴백.
              const fallback = selectedVehicle
                ? `/cars/${selectedVehicle.slug}`
                : "/cars";
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push(fallback);
              }
            }}
            aria-label="뒤로"
            className="flex h-11 w-11 items-center justify-center rounded-full text-text-strong transition-colors hover:bg-surface-soft"
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
        <div className="h-[2px] bg-border-subtle">
          <motion.div
            className="h-full bg-brand"
            initial={false}
            animate={{ width: `${(step / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </header>

      {/* 데스크톱 헤더 */}
      <div className="hidden border-b border-border-subtle bg-surface md:block">
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
      <main className="mx-auto max-w-[680px] px-5 py-8 max-[340px]:px-4 md:px-8 md:py-10">
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
              trimsError={trimsError}
              onRetryLoadTrims={loadVehicleDetails}
              canRequestConsultation={canRequestConsultation}
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
              selectedTrim={selectedTrim}
              trims={trims}
              vehicles={vehicles}
              conditions={conditions}
              selectedOptionIds={selectedOptionIds}
              customRates={customRates}
              costMode={costMode}
              isRecalculating={isRecalculating}
              isConsultationSubmitting={isConsultationSubmitting}
              consultationError={consultationError}
              kakaoDeliveryEnabled={kakaoDeliveryEnabled}
              channelTalkDelivery={channelTalkDelivery}
              isDelivering={isDelivering}
              deliverSuccess={deliverSuccess}
              deliveryError={deliveryError}
              onQuoteDeliver={
                kakaoDeliveryEnabled
                  ? handleQuoteDeliver
                  : handleQuoteReceiveViaChannelTalk
              }
              onReopenChannelChat={handleReopenChannelChat}
              onConfirmChannelSent={handleConfirmChannelSent}
              deliveryConfirmedBySender={deliveryConfirmedBySender}
              onCustomRatesChange={setCustomRates}
              onCostModeChange={setCostMode}
              onReset={restoreBaseStandardScenario}
              onMemberLogin={handleGateLogin}
              onConsultationRequest={handleConsultationRequest}
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

      <LoginRequiredModal
        open={deliveryLoginGateOpen}
        onClose={() => setDeliveryLoginGateOpen(false)}
        onKakaoLogin={() => void handleDeliveryLoginGateConfirm()}
        description={
          <>
            견적서는 회원에게만 보내드리고 있어요.
            <br />
            카카오톡으로 빠르게 시작해보세요.
          </>
        }
      />

      <QuoteDeliveryGuideModal
        open={deliveryGuideOpen}
        message={deliveryRequestMessage ?? ""}
        onClose={() => setDeliveryGuideOpen(false)}
        onConfirm={handleDeliveryGuideConfirm}
      />
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
        <p className="mt-3 break-keep text-[15px] leading-relaxed text-text-body">
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
                "flex w-full items-center gap-4 rounded-[20px] px-5 py-5 text-left transition-all duration-200 max-[340px]:gap-3 max-[340px]:px-4 md:px-6 md:py-6",
                selected
                  ? "bg-brand-soft ring-[1.5px] ring-brand"
                  : "bg-surface-soft ring-[1.5px] ring-transparent hover:ring-border-subtle"
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] transition-colors",
                  selected ? "bg-brand text-[var(--color-brand-ink)]" : "bg-surface text-text-body"
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-tight text-text-strong md:text-[18px]">
                  {option.title}
                </span>
                <span className="mt-1 block break-keep text-[13.5px] leading-snug text-text-body">
                  {option.desc}
                </span>
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all",
                  selected ? "bg-brand text-[var(--color-brand-ink)]" : "bg-border-subtle text-transparent"
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
  selectedTrim,
  trims,
  vehicles,
  conditions,
  selectedOptionIds,
  customRates,
  costMode,
  isRecalculating,
  isConsultationSubmitting,
  consultationError,
  kakaoDeliveryEnabled,
  channelTalkDelivery,
  isDelivering,
  deliverSuccess,
  deliveryError,
  onQuoteDeliver,
  onReopenChannelChat,
  onConfirmChannelSent,
  deliveryConfirmedBySender,
  onCustomRatesChange,
  onCostModeChange,
  onReset,
  onMemberLogin,
  onConsultationRequest,
  onPrev,
}: {
  quoteResult: QuoteResponse;
  selectedVehicle: VehicleListItem | null;
  customerType: CustomerType;
  contractCategory: "장기렌트" | "리스";
  selectedOptionDetails: { id: string; name: string; price: number }[];
  selectedExteriorColor: { name: string; hexCode: string; priceDelta: number } | null;
  selectedInteriorColor: { name: string; hexCode: string; priceDelta: number } | null;
  selectedTrim: { id: string; name: string; price: number; discountPrice: number | null; evSubsidy: number | null } | null;
  trims: { id: string; name: string; price: number; discountPrice: number | null }[];
  vehicles: VehicleListItem[];
  conditions: { contractMonths: number; annualMileage: number };
  selectedOptionIds: Set<string>;
  customRates: { depositRate: number; prepayRate: number };
  costMode: CostMode;
  isRecalculating: boolean;
  isConsultationSubmitting: boolean;
  consultationError: string | null;
  kakaoDeliveryEnabled: boolean;
  channelTalkDelivery: boolean;
  isDelivering: boolean;
  deliverSuccess: boolean;
  deliveryError: string | null;
  onQuoteDeliver: () => void;
  onReopenChannelChat: () => void;
  onConfirmChannelSent: () => void;
  deliveryConfirmedBySender: boolean;
  onCustomRatesChange: (rates: { depositRate: number; prepayRate: number }) => void;
  onCostModeChange: (mode: CostMode) => void;
  onReset: () => void;
  onMemberLogin: () => void;
  onConsultationRequest: () => void;
  onPrev: () => void;
}) {
  const standardScenario: QuoteScenarioDetail | undefined = quoteResult.scenarios.standard;
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
      {/* ── 1) 차량 정보 카드 ── */}
      <div className="overflow-hidden rounded-[24px] border border-border-subtle bg-surface shadow-soft">
        {/* 상단: 이미지(가로 절반) + 차량명 */}
        <div className="flex items-stretch gap-3 p-4 md:gap-4 md:p-5">
          <div className="relative aspect-[4/3] w-1/2 shrink-0 overflow-hidden rounded-[16px] bg-surface-soft">
            {selectedVehicle?.thumbnailUrl ? (
              <Image
                src={selectedVehicle.thumbnailUrl}
                alt={selectedVehicle.name ?? "차량"}
                fill
                sizes="(max-width: 768px) 50vw, 280px"
                unoptimized={isSupabaseStorageUrl(selectedVehicle.thumbnailUrl)}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] text-text-muted">
                이미지 없음
              </div>
            )}
          </div>
          <div className="flex min-w-0 w-1/2 flex-col justify-center py-0.5">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-text-muted">
              {selectedVehicle?.brand}
            </p>
            <p className="mt-1 text-[19px] font-extrabold leading-snug text-text-strong sm:text-[21px]">
              {selectedVehicle?.name}
            </p>
            {quoteResult.trimName && (
              <p className="mt-1.5 text-[14px] font-medium leading-snug text-text-body">
                {quoteResult.trimName}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4 md:px-5 md:pb-5">
          {/* 선택한 구성 — 별도 패널로 시각 구분 */}
          <div className="rounded-[16px] bg-surface-soft p-3.5 md:p-4">
            <p className="text-[12.5px] font-extrabold uppercase tracking-[0.07em] text-text-muted">
              선택한 구성
            </p>
            {selectedOptionDetails.length > 0 || selectedExteriorColor || selectedInteriorColor ? (
              <div className="mt-2.5 space-y-2.5">
                {selectedOptionDetails.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOptionDetails.map((o) => (
                      <span
                        key={o.id}
                        className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-[13px] font-bold text-text-body ring-1 ring-border-subtle"
                      >
                        {o.name}
                      </span>
                    ))}
                  </div>
                )}
                {(selectedExteriorColor || selectedInteriorColor) && (
                  <div className="flex flex-col gap-2 text-[14px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
                    {selectedExteriorColor && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-text-muted">외장</span>
                        <span
                          aria-hidden
                          className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: selectedExteriorColor.hexCode }}
                          title={selectedExteriorColor.hexCode}
                        />
                        <span className="font-bold text-text-strong">{selectedExteriorColor.name}</span>
                      </span>
                    )}
                    {selectedInteriorColor && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-text-muted">내장</span>
                        <span
                          aria-hidden
                          className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: selectedInteriorColor.hexCode }}
                          title={selectedInteriorColor.hexCode}
                        />
                        <span className="font-bold text-text-strong">{selectedInteriorColor.name}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[14px] font-medium text-text-body">기본 사양</p>
            )}
          </div>

          {/* 상품 / 계약기간 / 약정거리 — 카드형 3분할 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[14px] bg-surface-soft px-2.5 py-3 text-center">
              <p className="text-[12px] font-bold text-text-muted">상품</p>
              <p className="mt-1 text-[14.5px] font-extrabold leading-tight text-text-strong sm:text-[15px]">
                {productTypeLabel(contractCategory)}
              </p>
            </div>
            <div className="rounded-[14px] bg-surface-soft px-2.5 py-3 text-center">
              <p className="text-[12px] font-bold text-text-muted">계약기간</p>
              <p className="num mt-1 text-[14.5px] font-extrabold leading-tight tabular-nums text-text-strong sm:text-[15px]">
                {quoteResult.contractMonths}개월
              </p>
            </div>
            <div className="rounded-[14px] bg-surface-soft px-2.5 py-3 text-center">
              <p className="text-[12px] font-bold text-text-muted">약정거리</p>
              <p className="num mt-1 text-[14.5px] font-extrabold leading-tight tabular-nums text-text-strong sm:text-[15px]">
                연 {(quoteResult.annualMileage / 10000).toFixed(0)}만km
              </p>
            </div>
          </div>

          {/* 총 차량가 — 강조 블록 */}
          <div className="flex items-center justify-between gap-3 rounded-[16px] bg-brand-soft/70 px-4 py-3.5 ring-1 ring-brand/15">
            <div className="min-w-0">
              <p className="text-[12.5px] font-extrabold uppercase tracking-[0.06em] text-brand">
                총 차량가
              </p>
              <p className="mt-0.5 text-[12.5px] font-medium text-text-muted">
                {quoteResult.trimName ? "트림 + 옵션 포함" : "기준 차량가격"}
              </p>
            </div>
            <p className="num shrink-0 text-[26px] font-extrabold tabular-nums leading-none text-brand sm:text-[28px]">
              {Math.round(totalVehiclePrice / 10_000).toLocaleString()}
              <span className="ml-0.5 text-[15px] font-bold">만원</span>
            </p>
          </div>
        </div>
      </div>

      {quoteResult.requiresConsultation === true || !standardScenario ? (
        <>
          <div className="rounded-[24px] bg-brand p-6 text-[var(--color-brand-ink)] md:p-7">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-ink)]">월 납입금</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[30px] font-extrabold leading-tight text-[var(--color-brand-ink)] sm:text-[36px]">
                  별도 상담 필요
                </p>
                <p className="mt-2 text-[14px] font-bold text-[var(--color-brand-ink)]">
                  이 차량은 별도 상담이 필요합니다
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11.5px] font-bold text-[var(--color-brand-ink)]">
                <AlertCircle size={12} />
                견적 준비중
              </span>
            </div>
            <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-brand-ink)]">
              현재 자동 견적에 필요한 데이터가 등록되지 않아 정확한 월 납입금을 즉시 산출하기 어렵습니다.
              선택하신 조건 기준으로 상담을 통해 맞춤 견적을 안내해드릴게요.
            </p>
            <ChannelTalkButton
              vehicleName={selectedVehicle?.name}
              label="선택 조건으로 상담 요청하기"
              onClick={onConsultationRequest}
              loading={isConsultationSubmitting}
              className="mt-5 h-[48px] rounded-[14px] bg-white px-4 text-[14px] font-bold text-[var(--color-kakao-ink)] hover:bg-white/95"
            />
            {consultationError && (
              <p role="alert" className="mt-3 rounded-[10px] bg-white/10 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--color-brand-ink)]">
                {consultationError}
              </p>
            )}
          </div>

          <div className="rounded-[16px] bg-surface-soft p-4 text-[12px] leading-relaxed text-text-muted">
            옵션·계약조건에 따라 캐피탈사별 금액이 크게 달라질 수 있어 상담을 통한 견적이 더 정확합니다.
          </div>

          <button
            type="button"
            onClick={onPrev}
            className="mx-auto flex items-center gap-1 text-[13px] font-bold text-text-muted transition-colors hover:text-text-strong"
          >
            <ChevronLeft size={14} />
            조건 다시 설정하기
          </button>
        </>
      ) : (
        <>
          {/* ── 2) 월 납입금 대형 강조 (실제 데이터) ── */}
          <div className="rounded-[24px] bg-brand p-6 text-[var(--color-brand-ink)] md:p-7">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-ink)]">월 납입금</p>
              {isRecalculating && (
                <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--color-brand-ink)]">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[rgb(var(--color-brand-ink-rgb)/0.35)] border-t-[var(--color-brand-ink)]" />
                  재계산 중…
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <TossPrice won={standardScenario.monthlyPayment} size="xl" tone="onBrand" />
              {standardScenario.bestFinanceCompany && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11.5px] font-bold text-[var(--color-brand-ink)]">
                  <Building2 size={11} />
                  {standardScenario.bestFinanceCompany}
                </span>
              )}
            </div>
            <p className="mt-3 text-[13.5px] text-[var(--color-brand-ink)]">
              {CUSTOMER_TYPE_LABELS[customerType]} · {productTypeLabel(contractCategory)}
            </p>
          </div>

          {/* ── 3) 초기비용(보증금/선납금) 패널 ── */}
          <InitialCostPanelV2
            data={standardScenario}
            customRates={customRates}
            onCustomRatesChange={onCustomRatesChange}
            isRecalculating={isRecalculating}
            costMode={costMode}
            onCostModeChange={onCostModeChange}
            onMemberLogin={onMemberLogin}
            onReset={onReset}
          />

          {/* ── 4) EV 보조금 안내 (견적 미반영, 표시 전용) ── */}
          {selectedTrim?.evSubsidy ? (
            <EvSubsidyNotice amount={selectedTrim.evSubsidy} />
          ) : null}

          {/* ── 5) 심사 가능성 미리보기 ── */}
          <ApprovalPreviewV2 data={standardScenario} />

          {/* ── 6) 금융사별 견적 ── */}
          {standardScenario.allFinanceResults &&
            standardScenario.allFinanceResults.length >= 1 && (
              <FinanceSectionV2 results={standardScenario.allFinanceResults} />
            )}

          {/* ── 7) rangeExceeded 안내 (옵션 초과 시) ── */}
          {standardScenario.rangeExceeded && (
            <div className="flex items-start gap-2 rounded-[14px] border border-status-warning/25 bg-status-warning-soft px-4 py-3 text-[12px] leading-relaxed text-status-warning">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <p className="break-keep">
                선택하신 옵션 조합으로 차량가가 등록된 견적 기준 범위를 초과해 참고용 견적으로 표시돼요.
                정확한 금액은 상담을 통해 확인해 주세요.
              </p>
            </div>
          )}

          {/* ── 8) 다른 차량과 비교 (ComparisonSection 인라인) ── */}
          {selectedVehicle && (
            <ComparisonSection
              primary={{
                slug: selectedVehicle.slug,
                brand: selectedVehicle.brand,
                name: selectedVehicle.name,
                result: quoteResult,
                thumbnailUrl: selectedVehicle.thumbnailUrl,
                trims: trims as ComparisonTrimData[],
                currentTrimId: selectedTrim?.id ?? null,
                currentOptionIds: selectedOptionIds,
              }}
              conditions={{
                contractMonths: conditions.contractMonths as 36 | 48 | 60,
                annualMileage: conditions.annualMileage as 10000 | 20000 | 30000,
                contractType: "반납형",
                productType: contractCategory,
              }}
              allVehicles={vehicles}
              onMemberLogin={onMemberLogin}
            />
          )}

          {/* ── 10) 체크포인트 ── */}
          <CostCheckpointV2 contractType="반납형" customerType={customerType} />

          {/* ── 11) 안내 + CTA ── */}
          <div className="break-keep rounded-[16px] bg-surface-soft p-4 text-[12px] leading-relaxed text-text-body">
            <span className="inline-block">위 견적은 실제 계약 가능한 기준이나, 최종 금액은</span>{" "}
            <span className="inline-block">차량 상태·옵션·프로모션에 따라 달라질 수 있어요.</span>{" "}
            <span className="inline-block">전문가 상담으로 확정 견적을 받아보세요.</span>
          </div>

          <QuoteResultActions
            kakaoDeliveryEnabled={kakaoDeliveryEnabled}
            channelTalkDelivery={channelTalkDelivery}
            isDelivering={isDelivering}
            deliverySuccess={deliverSuccess}
            deliveryError={deliveryError}
            onQuoteDeliver={onQuoteDeliver}
            onReopenChannelChat={onReopenChannelChat}
            onConfirmChannelSent={onConfirmChannelSent}
            deliveryConfirmedBySender={deliveryConfirmedBySender}
          />

          <button
            type="button"
            onClick={onPrev}
            className="mx-auto flex items-center gap-1 text-[13px] font-bold text-text-muted transition-colors hover:text-text-strong"
          >
            <ChevronLeft size={14} />
            조건 다시 설정하기
          </button>
        </>
      )}
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
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 px-5 pb-[max(12px,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md md:static md:inset-auto md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="mx-auto flex max-w-[680px] gap-2">
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            className="flex h-[52px] items-center justify-center rounded-[14px] border border-border-subtle bg-surface px-5 text-[15px] font-bold text-text-body transition-colors hover:bg-surface-soft"
          >
            이전
          </button>
        )}
        <button
          type="button"
          onClick={onClick}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-brand text-[15px] font-bold text-[var(--color-brand-ink)] shadow-[0_4px_12px_rgba(39,54,138,0.18)] transition-all hover:bg-brand-pressed active:scale-[0.99]"
        >
          {icon}
          {label}
        </button>
      </div>
    </div>
  );
}
