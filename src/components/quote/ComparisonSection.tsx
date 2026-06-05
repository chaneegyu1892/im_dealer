"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitCompare, ChevronDown, HelpCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VehicleConfigPanel,
  type ComparisonTrimData,
} from "./VehicleConfigPanel";
import { ComparisonTable } from "./ComparisonTable";
import type { VehicleListItem, QuoteResponse } from "@/types/api";
import type { VehicleColorPublic } from "./ColorSelector";
import { useAuthUser } from "@/hooks/useAuthUser";
import { MemberGate } from "@/components/auth/MemberGate";

// ─── 타입 ───────────────────────────────────────────────────
type CostMode = "none" | "initial";
type CostType = "deposit" | "prepay";

const PRESET_RATES = [10, 20, 30] as const;
const SLIDER_MAX = 30;
const COST_TYPE_INFO = {
  deposit: { label: "보증금", subLabel: "만기 후 환급", tooltip: "계약 종료 시 돌려받는 금액입니다." },
  prepay: { label: "선납금", subLabel: "월납입 절감", tooltip: "미리 납부해 매달 내는 금액을 줄입니다." },
} as const;

export interface PrimaryVehicleInfo {
  slug: string;
  brand: string;
  name: string;
  result: QuoteResponse;
  thumbnailUrl?: string;
  trims: ComparisonTrimData[];
  currentTrimId: string | null;
  currentOptionIds: Set<string>;
}

export interface ContractConditions {
  contractMonths: 36 | 48 | 60;
  annualMileage: 10000 | 20000 | 30000;
  contractType: "반납형" | "인수형";
  productType: "장기렌트" | "리스";
}

interface ComparisonSectionProps {
  primary: PrimaryVehicleInfo;
  conditions: ContractConditions;
  allVehicles: VehicleListItem[];
  /** 비회원 게이트의 로그인 CTA 클릭 시 호출 — 견적 화면 상태를 저장 후 /login 으로 이동 */
  onMemberLogin?: () => void;
}

// ─── 초기비용 컨트롤 ─────────────────────────────────────────
interface InitialCostControlProps {
  depositRate: number;
  prepayRate: number;
  isRecalculating: boolean;
  onChange: (rates: { depositRate: number; prepayRate: number }) => void;
}

function InitialCostControl({
  depositRate,
  prepayRate,
  isRecalculating,
  onChange,
}: InitialCostControlProps) {
  const [costMode, setCostMode] = useState<CostMode>(
    depositRate > 0 || prepayRate > 0 ? "initial" : "none"
  );
  const [costType, setCostType] = useState<CostType>("deposit");

  const activeRate = costType === "deposit" ? depositRate : prepayRate;

  const switchMode = (mode: CostMode) => {
    setCostMode(mode);
    if (mode === "none") onChange({ depositRate: 0, prepayRate: 0 });
  };

  const switchCostType = (type: CostType) => {
    setCostType(type);
    onChange({ depositRate: 0, prepayRate: 0 });
  };

  const applyRate = (rate: number) => {
    if (costType === "deposit") {
      onChange({ depositRate: rate, prepayRate: 0 });
    } else {
      onChange({ depositRate: 0, prepayRate: rate });
    }
  };

  return (
    <div className="space-y-3 bg-white border border-[#F0F0F0] rounded-[12px] p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#4A5270] uppercase tracking-wider">
          초기비용 설정
        </p>
        <span className={cn(
          "flex items-center gap-1.5 text-[11px] text-[#9BA4C0] transition-opacity duration-200",
          isRecalculating ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          <span className="inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          재계산 중…
        </span>
      </div>

      {/* 없음 / 있음 토글 */}
      <div className="grid grid-cols-2 gap-2">
        {(["none", "initial"] as CostMode[]).map((mode) => {
          const isActive = costMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => switchMode(mode)}
              className={cn(
                "py-3 px-3 rounded-[12px] border-2 text-left transition-all duration-150",
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-[#E8E8E8] bg-white hover:border-primary/30"
              )}
            >
              <span className="block text-[10px] font-medium uppercase tracking-wider text-[#9BA4C0] mb-0.5">
                초기비용
              </span>
              <span className={cn("block text-[14px] font-semibold", isActive ? "text-primary" : "text-[#1A1A2E]")}>
                {mode === "none" ? "없음" : "있음"}
              </span>
              <span className="block text-[11px] text-[#9BA4C0] mt-0.5">
                {mode === "none" ? "보증금·선납금 없이" : "초기 납부로 월납입 절감"}
              </span>
            </button>
          );
        })}
      </div>

      {/* 초기비용 상세 설정 */}
      <AnimatePresence initial={false}>
        {costMode === "initial" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">
              {/* 보증금 / 선납금 탭 */}
              <div className="flex gap-2">
                {(["deposit", "prepay"] as CostType[]).map((type) => {
                  const info = COST_TYPE_INFO[type];
                  const isActive = costType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => switchCostType(type)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-[10px] border text-left transition-all duration-150",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-[#E8E8E8] bg-[#F8F9FC] hover:border-primary/30"
                      )}
                    >
                      <span className={cn("block text-[13px] font-semibold", isActive ? "text-primary" : "text-[#1A1A2E]")}>
                        {info.label}
                      </span>
                      <span className="block text-[10px] text-[#9BA4C0]">{info.subLabel}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  title={COST_TYPE_INFO[costType].tooltip}
                  onClick={() => alert(COST_TYPE_INFO[costType].tooltip)}
                  className="p-2 rounded-full text-[#9BA4C0] hover:text-[#4A5270] hover:bg-[#F0F2F8] transition-colors shrink-0 self-center"
                >
                  <HelpCircle size={15} />
                </button>
              </div>

              {/* 비율 프리셋 + 슬라이더 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#9BA4C0]">
                    {COST_TYPE_INFO[costType].label} 비율 선택
                  </p>
                  {/* 현재 값 표시 */}
                  <span className={cn(
                    "text-[14px] font-bold tabular-nums transition-colors",
                    activeRate > 0 ? "text-primary" : "text-[#9BA4C0]"
                  )}>
                    {activeRate}%
                  </span>
                </div>

                {/* 프리셋 버튼 */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyRate(0)}
                    className={cn(
                      "px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all duration-150",
                      activeRate === 0
                        ? "bg-[#1A1A2E] text-white border-[#1A1A2E]"
                        : "bg-white text-[#6B7399] border-[#E0E0E0] hover:border-[#1A1A2E]/40"
                    )}
                  >
                    없음
                  </button>
                  {PRESET_RATES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => applyRate(r)}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-[12px] font-medium transition-all duration-150",
                        activeRate === r
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-[#6B7399] border-[#E0E0E0] hover:border-primary/40"
                      )}
                    >
                      {r}%
                    </button>
                  ))}
                </div>

                {/* 슬라이더 */}
                <div className="space-y-1">
                  <div className="relative h-5 flex items-center">
                    <div className="absolute inset-x-0 h-[6px] rounded-full bg-[#E2E8F0] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${(activeRate / SLIDER_MAX) * 100}%`,
                          background: "linear-gradient(90deg, #000666 0%, #6066EE 100%)",
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={SLIDER_MAX}
                      step={1}
                      value={activeRate}
                      onChange={(e) => applyRate(Number(e.target.value))}
                      className="absolute inset-0 opacity-0 w-full cursor-pointer"
                    />
                    {/* 썸 */}
                    <div
                      className="absolute w-5 h-5 rounded-full -translate-x-1/2 pointer-events-none transition-all duration-200 shadow-md"
                      style={{
                        left: `${(activeRate / SLIDER_MAX) * 100}%`,
                        background: "#fff",
                        border: "2.5px solid #000666",
                        boxShadow: activeRate > 0 ? "0 1px 8px rgba(0,6,102,0.3)" : "0 1px 4px rgba(0,0,0,0.15)",
                      }}
                    />
                  </div>
                  {/* 클릭 가능한 눈금 레이블 */}
                  <div className="flex justify-between px-0.5">
                    {[0, 10, 20, 30].map((tick) => (
                      <button
                        key={tick}
                        type="button"
                        onClick={() => applyRate(tick)}
                        className={cn(
                          "text-[10px] font-medium transition-colors px-0.5",
                          activeRate === tick
                            ? "text-primary font-bold"
                            : "text-[#9BA4C0] hover:text-primary"
                        )}
                      >
                        {tick}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(depositRate > 0 || prepayRate > 0) && (
                <p className="text-[12px] text-primary font-medium">
                  두 차량 모두{" "}
                  {depositRate > 0 ? `보증금 ${depositRate}%` : `선납금 ${prepayRate}%`} 적용
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────
export function ComparisonSection({
  primary,
  conditions,
  allVehicles,
  onMemberLogin,
}: ComparisonSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 비교 기능은 회원 전용. 비회원에게는 펼친 패널을 블러 처리하고 카카오 로그인을 유도한다.
  // user 는 null 로 시작 → 로딩 중엔 잠금 기본값(보증/선납 게이트와 동일).
  const { user } = useAuthUser();
  const locked = !user;

  // ── 패널 1 상태 ──────────────────────────────────────────────
  const [p1TrimId, setP1TrimId] = useState<string | null>(primary.currentTrimId);
  const [p1OptionIds, setP1OptionIds] = useState<Set<string>>(new Set(primary.currentOptionIds));
  const [p1Colors, setP1Colors] = useState<VehicleColorPublic[]>([]);
  const [p1ExtColor, setP1ExtColor] = useState<string | null>(null);
  const [p1IntColor, setP1IntColor] = useState<string | null>(null);
  const [p1ProductType, setP1ProductType] = useState<"장기렌트" | "리스">(conditions.productType);

  // ── 패널 2 상태 ──────────────────────────────────────────────
  const [p2Slug, setP2Slug] = useState("");
  const [p2Trims, setP2Trims] = useState<ComparisonTrimData[]>([]);
  const [p2TrimsLoading, setP2TrimsLoading] = useState(false);
  const [p2TrimId, setP2TrimId] = useState<string | null>(null);
  const [p2OptionIds, setP2OptionIds] = useState<Set<string>>(new Set());
  const [p2Colors, setP2Colors] = useState<VehicleColorPublic[]>([]);
  const [p2ExtColor, setP2ExtColor] = useState<string | null>(null);
  const [p2IntColor, setP2IntColor] = useState<string | null>(null);
  const [p2ProductType, setP2ProductType] = useState<"장기렌트" | "리스">(conditions.productType);

  // ── 비교 결과 ────────────────────────────────────────────────
  const [primaryResult, setPrimaryResult] = useState<QuoteResponse | null>(null);
  const [compResult, setCompResult] = useState<QuoteResponse | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // ── 공유 초기비용 (결과 표시 후 슬라이더) ───────────────────
  const [sharedRates, setSharedRates] = useState({ depositRate: 0, prepayRate: 0 });
  const hasResults = !!(primaryResult && compResult);

  // ── 모바일 탭 ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"primary" | "comparison">("primary");

  const abortRef = useRef<AbortController | null>(null);
  const recalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 차량 복사 시 트림·옵션 동기화에 사용
  const copyTrimRef = useRef<{ trimId: string | null; optionIds: Set<string> } | null>(null);

  // 패널 1 색상 로드 (primary 차량)
  useEffect(() => {
    if (!primary.slug) return;
    let aborted = false;
    fetch(`/api/vehicles/${primary.slug}/colors`)
      .then((r) => r.json())
      .then((json) => {
        if (aborted || !json?.success || !Array.isArray(json.data)) return;
        const list: VehicleColorPublic[] = json.data;
        setP1Colors(list);
        const defExt = list.find((c) => c.kind === "EXTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "EXTERIOR");
        const defInt = list.find((c) => c.kind === "INTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "INTERIOR");
        setP1ExtColor(defExt?.id ?? null);
        setP1IntColor(defInt?.id ?? null);
      })
      .catch(() => {});
    return () => { aborted = true; };
  }, [primary.slug]);

  // 비교 차량 트림 + 색상 로드
  useEffect(() => {
    if (!p2Slug) {
      setP2Trims([]);
      setP2TrimId(null);
      setP2OptionIds(new Set());
      setP2Colors([]);
      setP2ExtColor(null);
      setP2IntColor(null);
      return;
    }
    let aborted = false;
    setP2TrimsLoading(true);
    setP2Trims([]);
    setP2TrimId(null);
    setP2OptionIds(new Set());
    setP2Colors([]);
    setP2ExtColor(null);
    setP2IntColor(null);

    Promise.all([
      fetch(`/api/vehicles/${p2Slug}/trims`).then((r) => r.json()),
      fetch(`/api/vehicles/${p2Slug}/colors`).then((r) => r.json()),
    ])
      .then(([trimJson, colorJson]) => {
        if (aborted) return;
        if (trimJson.success && Array.isArray(trimJson.data)) {
          const loadedTrims = trimJson.data as ComparisonTrimData[];
          setP2Trims(loadedTrims);
          // 현재 차량 복사 시 트림·옵션 자동 세팅
          if (copyTrimRef.current) {
            const { trimId, optionIds } = copyTrimRef.current;
            // 로딩된 트림 목록에 해당 trimId가 있을 때만 세팅
            if (trimId && loadedTrims.some((t) => t.id === trimId)) {
              setP2TrimId(trimId);
              setP2OptionIds(new Set(optionIds));
            }
            copyTrimRef.current = null;
          }
        }
        if (colorJson?.success && Array.isArray(colorJson.data)) {
          const list: VehicleColorPublic[] = colorJson.data;
          setP2Colors(list);
          const defExt = list.find((c) => c.kind === "EXTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "EXTERIOR");
          const defInt = list.find((c) => c.kind === "INTERIOR" && c.isDefault) ?? list.find((c) => c.kind === "INTERIOR");
          setP2ExtColor(defExt?.id ?? null);
          setP2IntColor(defInt?.id ?? null);
        }
      })
      .catch(() => {})
      .finally(() => { if (!aborted) setP2TrimsLoading(false); });

    return () => { aborted = true; };
  }, [p2Slug]);

  // 섹션 열릴 때 패널 1 초기값 동기화
  const handleOpen = () => {
    if (!isOpen) {
      setP1TrimId(primary.currentTrimId);
      setP1OptionIds(new Set(primary.currentOptionIds));
      setP1ProductType(conditions.productType);
      setPrimaryResult(null);
      setCompResult(null);
      setSharedRates({ depositRate: 0, prepayRate: 0 });
      setCompareError(null);
    }
    setIsOpen((v) => !v);
  };

  // 현재 차량을 비교 패널로 복사 (트림·옵션 포함)
  const handleCopyPrimary = () => {
    // 트림 로드 완료 후 자동 세팅하기 위해 ref에 저장
    copyTrimRef.current = { trimId: p1TrimId, optionIds: new Set(p1OptionIds) };
    setP2Slug(primary.slug);
    setPrimaryResult(null);
    setCompResult(null);
  };

  // ── API 호출 공통 함수 ───────────────────────────────────────
  const fetchBothQuotes = useCallback(async (
    rates: { depositRate: number; prepayRate: number },
    isInitial: boolean,
  ) => {
    if (!p1TrimId || !p2Slug || !p2TrimId) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (isInitial) setIsComparing(true);
    else setIsRecalculating(true);
    setCompareError(null);

    const baseConditions = {
      contractMonths: conditions.contractMonths,
      annualMileage: conditions.annualMileage,
      contractType: conditions.contractType,
    };

    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/vehicles/${primary.slug}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...baseConditions,
            productType: p1ProductType,
            trimId: p1TrimId,
            selectedOptionIds: Array.from(p1OptionIds),
            ...(p1ExtColor && { exteriorColorId: p1ExtColor }),
            ...(p1IntColor && { interiorColorId: p1IntColor }),
            ...(rates.depositRate > 0 && { customDepositRate: rates.depositRate }),
            ...(rates.prepayRate > 0 && { customPrepayRate: rates.prepayRate }),
          }),
          signal: ctrl.signal,
        }),
        fetch(`/api/vehicles/${p2Slug}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...baseConditions,
            productType: p2ProductType,
            trimId: p2TrimId,
            selectedOptionIds: Array.from(p2OptionIds),
            ...(p2ExtColor && { exteriorColorId: p2ExtColor }),
            ...(p2IntColor && { interiorColorId: p2IntColor }),
            ...(rates.depositRate > 0 && { customDepositRate: rates.depositRate }),
            ...(rates.prepayRate > 0 && { customPrepayRate: rates.prepayRate }),
          }),
          signal: ctrl.signal,
        }),
      ]);

      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      if (ctrl.signal.aborted) return;

      if (!j1.success || !j2.success) {
        setCompareError(j1.error ?? j2.error ?? "견적 계산에 실패했습니다.");
        return;
      }

      setPrimaryResult(j1.data as QuoteResponse);
      setCompResult(j2.data as QuoteResponse);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setCompareError("네트워크 오류가 발생했습니다.");
    } finally {
      if (!ctrl.signal.aborted) {
        setIsComparing(false);
        setIsRecalculating(false);
      }
    }
  }, [p1TrimId, p1OptionIds, p1ExtColor, p1IntColor, p1ProductType,
      p2Slug, p2TrimId, p2OptionIds, p2ExtColor, p2IntColor, p2ProductType,
      conditions, primary.slug]);

  // 초기비용 변경 시 디바운스 재계산 (결과가 있을 때만)
  const handleRatesChange = (rates: { depositRate: number; prepayRate: number }) => {
    setSharedRates(rates);
    if (!hasResults) return;

    if (recalcTimerRef.current) clearTimeout(recalcTimerRef.current);
    recalcTimerRef.current = setTimeout(() => {
      void fetchBothQuotes(rates, false);
    }, 500);
  };

  const canCompare = !!p1TrimId && !!p2Slug && !!p2TrimId;
  const p2Meta = allVehicles.find((v) => v.slug === p2Slug);

  return (
    <div className="bg-white rounded-card border border-[#F0F0F0] shadow-card overflow-hidden mb-4">
      {/* 섹션 헤더 */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-neutral transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
          <GitCompare size={15} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
            다른 차량과 비교하기
            {locked && <Lock size={12} className="text-ink-caption shrink-0" />}
          </p>
          <p className="text-[12px] text-ink-caption mt-0.5">
            {locked
              ? "회원 전용 기능입니다. 로그인하고 나란히 비교하세요"
              : "트림·옵션을 각각 설정하고 나란히 비교할 수 있습니다"}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={cn("text-primary shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {/* 섹션 바디 — 비회원은 블러 + 카카오 로그인 유도 */}
      {isOpen && (
        <div className="border-t border-[#F0F0F0]">
        <MemberGate
          locked={locked}
          onLogin={onMemberLogin}
          message="비교는 회원 전용입니다. 로그인 해주세요"
        >
          {/* 모바일 탭 */}
          <div className="md:hidden flex border-b border-[#F0F2F8]">
            {(["primary", "comparison"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-2.5 text-[13px] font-medium transition-colors",
                  activeTab === tab
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-[#6B7399] hover:bg-neutral"
                )}
              >
                {tab === "primary" ? "현재 차량" : "비교 차량"}
              </button>
            ))}
          </div>

          {/* 두 패널 */}
          <div className="md:grid md:grid-cols-2 md:divide-x md:divide-[#F0F2F8]">
            {/* 패널 1 */}
            <div className={cn("min-h-[320px]", activeTab === "primary" ? "block" : "hidden md:block")}>
              <VehicleConfigPanel
                mode="primary"
                vehicleBrand={primary.brand}
                vehicleName={primary.name}
                thumbnailUrl={primary.thumbnailUrl}
                trims={primary.trims}
                selectedTrimId={p1TrimId}
                onTrimChange={(id) => { setP1TrimId(id); setP1OptionIds(new Set()); setPrimaryResult(null); setCompResult(null); }}
                selectedOptionIds={p1OptionIds}
                onOptionToggle={(id) => {
                  setP1OptionIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
                  setPrimaryResult(null); setCompResult(null);
                }}
                onOptionsClear={() => { setP1OptionIds(new Set()); setPrimaryResult(null); setCompResult(null); }}
                colors={p1Colors}
                exteriorColorId={p1ExtColor}
                interiorColorId={p1IntColor}
                onColorChange={(kind, id) => {
                  if (kind === "EXTERIOR") setP1ExtColor(id);
                  else setP1IntColor(id);
                  setPrimaryResult(null); setCompResult(null);
                }}
                productType={p1ProductType}
                onProductTypeChange={(v) => { setP1ProductType(v); setPrimaryResult(null); setCompResult(null); }}
              />
            </div>

            {/* 패널 2 */}
            <div className={cn("min-h-[320px] border-t border-[#F0F2F8] md:border-t-0", activeTab === "comparison" ? "block" : "hidden md:block")}>
              <VehicleConfigPanel
                mode="comparison"
                allVehicles={allVehicles}
                excludeSlug={primary.slug}
                selectedSlug={p2Slug}
                onVehicleChange={(slug) => { setP2Slug(slug); setPrimaryResult(null); setCompResult(null); }}
                trims={p2Trims}
                trimsLoading={p2TrimsLoading}
                selectedTrimId={p2TrimId}
                onTrimChange={(id) => { setP2TrimId(id); setP2OptionIds(new Set()); setPrimaryResult(null); setCompResult(null); }}
                selectedOptionIds={p2OptionIds}
                onOptionToggle={(id) => {
                  setP2OptionIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
                  setPrimaryResult(null); setCompResult(null);
                }}
                onOptionsClear={() => { setP2OptionIds(new Set()); setPrimaryResult(null); setCompResult(null); }}
                colors={p2Colors}
                exteriorColorId={p2ExtColor}
                interiorColorId={p2IntColor}
                onColorChange={(kind, id) => {
                  if (kind === "EXTERIOR") setP2ExtColor(id);
                  else setP2IntColor(id);
                  setPrimaryResult(null); setCompResult(null);
                }}
                productType={p2ProductType}
                onProductTypeChange={(v) => { setP2ProductType(v); setPrimaryResult(null); setCompResult(null); }}
                primarySlug={primary.slug}
                onCopyPrimary={handleCopyPrimary}
              />
            </div>
          </div>

          {/* 비교 버튼 */}
          <div className="px-4 py-4 border-t border-[#F0F2F8] space-y-2">
            {!canCompare && (
              <p className="text-[12px] text-[#9BA4C0] text-center">
                {!p1TrimId ? "현재 차량의 트림을 선택해주세요" : !p2Slug ? "비교할 차량을 선택해주세요" : "비교 차량의 트림을 선택해주세요"}
              </p>
            )}
            <button
              type="button"
              onClick={() => void fetchBothQuotes(sharedRates, true)}
              disabled={!canCompare || isComparing}
              className={cn(
                "w-full py-3 rounded-[10px] text-[14px] font-bold transition-all",
                canCompare && !isComparing
                  ? "bg-primary text-white hover:opacity-90 shadow-md shadow-primary/20"
                  : "bg-neutral text-[#9BA4C0] cursor-not-allowed"
              )}
            >
              {isComparing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  견적 계산 중...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <GitCompare size={16} />
                  비교 견적 계산하기
                </span>
              )}
            </button>
            <p className="text-[11px] text-ink-caption text-center">
              계약 {conditions.contractMonths}개월 · 연 {(conditions.annualMileage / 10000).toFixed(0)}만km · {conditions.contractType} · {conditions.productType}
            </p>
          </div>

          {/* 에러 */}
          {compareError && (
            <div className="mx-4 mb-4 bg-red-50 border border-red-100 rounded-[8px] p-3 text-[13px] text-red-500">
              {compareError}
            </div>
          )}

          {/* 결과 영역 */}
          <AnimatePresence>
            {primaryResult && compResult && p2Meta && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-4 pb-4 space-y-3"
              >
                {/* ── 공유 초기비용 컨트롤 ── */}
                <InitialCostControl
                  depositRate={sharedRates.depositRate}
                  prepayRate={sharedRates.prepayRate}
                  isRecalculating={isRecalculating}
                  onChange={handleRatesChange}
                />

                {/* ── 비교 테이블 ── */}
                <ComparisonTable
                  primary={{ brand: primary.brand, name: primary.name, result: primaryResult }}
                  comparison={{ brand: p2Meta.brand, name: p2Meta.name, result: compResult }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </MemberGate>
        </div>
      )}
    </div>
  );
}
