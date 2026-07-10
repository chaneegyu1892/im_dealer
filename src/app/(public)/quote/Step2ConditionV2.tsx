"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, ChevronDown, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { SelectSheet, type SelectOption } from "./SelectSheet";
import type { VehicleColorPublic } from "@/components/quote/ColorSelector";

// ─── 타입 ────────────────────────────────────────────────
export interface TrimOptionV2 {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  badge: string | null;
}

export interface TrimRuleV2 {
  ruleType: string;
  sourceOptionId: string;
  targetOptionId: string;
}

export interface TrimDataV2 {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  engineType: string;
  fuelEfficiency: number | null;
  options: TrimOptionV2[];
  rules: TrimRuleV2[];
}

interface Step2ConditionV2Props {
  hasCascade: boolean;
  lineupChoices: readonly { name: string; trimCount: number }[];
  selectedLineup: string | null;
  onLineupChange: (lineup: string | null) => void;
  cascadeTrimChoices: readonly { id: string; name: string; extra: string | null; price: number; discountPrice: number | null }[];
  flatTrimChoices: readonly { id: string; name: string; extra: string | null; price: number; discountPrice: number | null }[];
  selectedTrimId: string | null;
  onTrimChange: (trimId: string | null) => void;
  selectedTrim: TrimDataV2 | null;
  trimsLoading: boolean;
  trimsError: boolean;
  onRetryLoadTrims: () => void;
  canRequestConsultation: boolean;
  selectedOptionIds: Set<string>;
  onOptionToggle: (optionId: string) => void;
  optionsTotalPrice: number;
  selectedOptionDetails: { id: string; name: string; price: number }[];
  colors: readonly VehicleColorPublic[];
  exteriorColorId: string | null;
  interiorColorId: string | null;
  onColorChange: (kind: "EXTERIOR" | "INTERIOR", colorId: string | null) => void;
  colorDelta: number;
  contractCategory: "장기렌트" | "리스";
  onContractCategoryChange: (c: "장기렌트" | "리스") => void;
  contractMonths: number;
  onContractMonthsChange: (m: number) => void;
  annualMileage: number;
  onAnnualMileageChange: (m: number) => void;
  onPrev: () => void;
  onCalculate: () => void;
  isLoading: boolean;
  error: string | null;
}

const CONTRACT_CATEGORIES = ["장기렌트", "리스"] as const;
const CONTRACT_MONTHS = [36, 48, 60] as const;
const ANNUAL_MILEAGES = [10000, 20000, 30000] as const;

function fmtMan(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

// ════════════════════════════════════════════════════════════
// 메인 — STEP 2 (세로 스크롤 나열, 탭 없음)
// ════════════════════════════════════════════════════════════
export function Step2ConditionV2({
  hasCascade,
  lineupChoices,
  selectedLineup,
  onLineupChange,
  cascadeTrimChoices,
  flatTrimChoices,
  selectedTrimId,
  onTrimChange,
  selectedTrim,
  trimsLoading,
  trimsError,
  onRetryLoadTrims,
  canRequestConsultation,
  selectedOptionIds,
  onOptionToggle,
  optionsTotalPrice,
  colors,
  exteriorColorId,
  interiorColorId,
  onColorChange,
  colorDelta,
  contractCategory,
  onContractCategoryChange,
  contractMonths,
  onContractMonthsChange,
  annualMileage,
  onAnnualMileageChange,
  onPrev,
  onCalculate,
  isLoading,
  error,
}: Step2ConditionV2Props) {
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);

  // 트림 SelectSheet 옵션 구성
  const trimOptions: SelectOption[] = (hasCascade ? cascadeTrimChoices : flatTrimChoices).map((t) => ({
    value: t.id,
    label: t.extra ? `${t.name} (${t.extra})` : t.name,
    hint: t.discountPrice ? `${fmtMan(t.discountPrice)} (할인)` : fmtMan(t.price),
  }));
  const canSkipTrimSelection =
    canRequestConsultation && !trimsLoading && !trimsError && trimOptions.length === 0;
  const canShowConditionSections = !!selectedTrim || canSkipTrimSelection;
  const canCalculate = canShowConditionSections && !isLoading && !trimsError;
  const ctaLabel = selectedTrim
    ? "월 납입금 확인하기"
    : canSkipTrimSelection
      ? "상담 필요 견적 확인하기"
      : "트림을 선택하세요";

  // 라인업 SelectSheet 옵션
  const lineupOptions: SelectOption[] = lineupChoices.map((l) => ({
    value: l.name,
    label: l.name,
    hint: `${l.trimCount}개 트림`,
  }));

  // 색상 SelectSheet 옵션
  const exteriorColors = colors.filter((c) => c.kind === "EXTERIOR");
  const interiorColors = colors.filter((c) => c.kind === "INTERIOR");
  const exteriorOptions: SelectOption[] = exteriorColors.map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.priceDelta > 0 ? `+${fmtMan(c.priceDelta)}` : "기본",
    leading: (
      <span
        aria-hidden
        className="block h-7 w-7 rounded-full border border-[#E5E8EB]"
        style={{ background: c.hexCode }}
      />
    ),
  }));
  const interiorOptions: SelectOption[] = interiorColors.map((c) => ({
    value: c.id,
    label: c.name,
    hint: c.priceDelta > 0 ? `+${fmtMan(c.priceDelta)}` : "기본",
    leading: (
      <span
        aria-hidden
        className="block h-7 w-7 rounded-full border border-[#E5E8EB]"
        style={{ background: c.hexCode }}
      />
    ),
  }));

  const colorTriggerLeading = (colorId: string | null) => {
    if (!colorId) return null;
    const c = colors.find((x) => x.id === colorId);
    if (!c) return null;
    return (
      <span
        aria-hidden
        className="block h-6 w-6 rounded-full border border-[#E5E8EB]"
        style={{ background: c.hexCode }}
      />
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.22 }}
      className="space-y-8"
    >
      {/* ─── 1. 라인업 + 트림 (최우선 — 트림 선택 전엔 다른 섹션 숨김) ─── */}
      <section className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[12px] font-extrabold text-white">1</span>
            <SectionTitle title="트림 선택" />
          </div>
          {!selectedTrim && !trimsLoading && (
            <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-brand">
              {canSkipTrimSelection
                ? "자동 견적 준비중인 차량이에요. 조건을 선택하면 상담 필요 견적 화면으로 이동해요."
                : "먼저 차량 트림을 골라주세요. 트림 선택 후 옵션·색상·계약조건이 열려요."}
            </p>
          )}
        </div>
        {trimsError ? (
          <div className="flex flex-col gap-3 rounded-[16px] bg-status-danger-soft p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-status-danger">
                <AlertCircle size={17} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-extrabold text-text-strong">트림 정보를 불러오지 못했어요</p>
                <p className="mt-1 text-[13px] leading-relaxed text-text-body">
                  일시적인 네트워크 오류일 수 있어요. 다시 시도해 주세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRetryLoadTrims}
              className="public-touch-button w-fit bg-brand text-white"
            >
              다시 불러오기
            </button>
          </div>
        ) : trimsLoading ? (
          <div className="flex h-[54px] items-center gap-2 rounded-[14px] bg-[#F8FAFC] px-4 text-[14px] text-text-muted">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E5E8EB] border-t-brand" />
            트림 정보 불러오는 중...
          </div>
        ) : canSkipTrimSelection ? (
          <div className="flex items-start gap-3 rounded-[16px] bg-brand-soft p-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand">
              <AlertCircle size={17} strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <p className="text-[14.5px] font-extrabold text-text-strong">트림 정보 등록 준비중</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-body">
                선택 가능한 트림이 아직 없어도 상품 유형, 계약기간, 약정거리를 기준으로 상담 요청을 진행할 수 있어요.
              </p>
            </div>
          </div>
        ) : (
          <>
            {hasCascade && (
              <SelectSheet
                id="lineup-select"
                label="라인업"
                placeholder="라인업을 선택하세요"
                value={selectedLineup}
                options={lineupOptions}
                onChange={(v) => {
                  onLineupChange(v);
                  if (v !== selectedLineup) onTrimChange(null);
                }}
                sheetTitle="라인업 선택"
              />
            )}
            <SelectSheet
              id="trim-select"
              label={hasCascade ? "트림" : "차량 트림"}
              placeholder={hasCascade && !selectedLineup ? "라인업을 먼저 선택하세요" : "트림을 선택하세요"}
              value={hasCascade ? selectedTrimId : selectedLineup}
              options={trimOptions}
              disabled={hasCascade && !selectedLineup}
              onChange={(v) => onTrimChange(v)}
              sheetTitle="트림 선택"
            />
          </>
        )}

        {/* 선택된 트림 요약 */}
        {selectedTrim && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[16px] bg-brand-soft p-4"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-body">
              <span className="font-bold text-text-strong">{selectedTrim.name}</span>
              <span>{selectedTrim.engineType}</span>
              {selectedTrim.fuelEfficiency ? <span>연비 {selectedTrim.fuelEfficiency}km/L</span> : null}
            </div>
            <p className="num mt-1.5 text-[14px] font-extrabold text-text-strong tabular-nums">
              차량가 {fmtMan((selectedTrim.discountPrice ?? selectedTrim.price) + optionsTotalPrice + colorDelta)}
            </p>
            {selectedTrim.discountPrice != null && selectedTrim.discountPrice < selectedTrim.price && (
              <p className="num mt-0.5 text-[11.5px] text-status-danger tabular-nums">
                {fmtMan(selectedTrim.price - selectedTrim.discountPrice)} 할인
              </p>
            )}
          </motion.div>
        )}
      </section>

      {/* ─── 2~4: 옵션 · 색상 · 계약조건 — 트림 선택 후 fade-in ─── */}
      {canShowConditionSections && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >

      {/* ─── 2. 추가 옵션 ─── */}
      {selectedTrim && selectedTrim.options.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle title="추가 옵션" />
            <span className="num rounded-full bg-[#F8FAFC] px-2.5 py-1 text-[12px] font-bold text-text-body tabular-nums">
              {selectedOptionIds.size}개 · +{fmtMan(optionsTotalPrice)}
            </span>
          </div>
          <p className="-mt-1 text-[13px] text-text-body">필요한 옵션만 선택하면 차량가에 반영돼요.</p>

          <div className="overflow-hidden rounded-[16px] bg-[#F8FAFC] divide-y divide-[#E5E8EB]">
            {selectedTrim.options.map((opt) => {
              const isSelected = selectedOptionIds.has(opt.id);
              const isExpanded = expandedOptionId === opt.id;
              const hasDesc = !!opt.description;
              return (
                <div key={opt.id}>
                  <div className="flex min-h-[56px] items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOptionToggle(opt.id)}
                      aria-label={opt.name}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition-colors",
                        isSelected ? "border-brand bg-brand" : "border-[#D7DCE2] bg-transparent"
                      )}
                    >
                      {isSelected && <Check size={15} strokeWidth={3} className="text-white" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOptionToggle(opt.id)}
                      className={cn(
                        "flex-1 text-left text-[14px] flex items-center gap-1.5 flex-wrap",
                        isSelected ? "font-bold text-brand" : "text-text-strong"
                      )}
                    >
                      <span>{opt.name}</span>
                      {opt.badge && (
                        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-brand">
                          {opt.badge}
                        </span>
                      )}
                    </button>
                    <span className={cn(
                      "num shrink-0 text-[12.5px] font-bold tabular-nums",
                      isSelected ? "text-brand" : "text-text-body"
                    )}>
                      +{opt.price >= 10000 ? fmtMan(opt.price) : `${opt.price.toLocaleString()}원`}
                    </span>
                    {hasDesc && (
                      <button
                        type="button"
                        onClick={() => setExpandedOptionId(isExpanded ? null : opt.id)}
                        className="shrink-0 rounded-md p-2 hover:bg-white"
                        aria-label="설명 보기"
                      >
                        <ChevronDown
                          size={15}
                          className={cn("text-text-muted transition-transform duration-200", isExpanded && "rotate-180")}
                        />
                      </button>
                    )}
                  </div>
                  <AnimatePresence>
                    {isExpanded && hasDesc && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-14 pb-3 text-[13px] leading-relaxed text-text-body">
                          {opt.description}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── 3. 색상 ─── */}
      {colors.length > 0 && (exteriorColors.length > 0 || interiorColors.length > 0) && selectedTrim && (
        <section className="space-y-3">
          <SectionTitle title="색상 선택" />
          {exteriorColors.length > 0 && (
            <SelectSheet
              id="exterior-color"
              label="외장 색상"
              placeholder="외장 색상을 선택하세요"
              value={exteriorColorId}
              options={exteriorOptions}
              onChange={(v) => onColorChange("EXTERIOR", v)}
              triggerLeading={colorTriggerLeading}
              sheetTitle="외장 색상 선택"
            />
          )}
          {interiorColors.length > 0 && (
            <SelectSheet
              id="interior-color"
              label="내장 색상"
              placeholder="내장 색상을 선택하세요"
              value={interiorColorId}
              options={interiorOptions}
              onChange={(v) => onColorChange("INTERIOR", v)}
              triggerLeading={colorTriggerLeading}
              sheetTitle="내장 색상 선택"
            />
          )}
        </section>
      )}

      {/* ─── 4. 계약 조건 ─── */}
      <section className="space-y-5">
        <SectionTitle title="계약 조건" />

        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted">상품 유형</p>
          <p className="mb-2.5 mt-0.5 text-[12.5px] text-text-body">장기렌트: 보험·세금 포함 · 리스: 소유권 이전 가능</p>
          <div className="grid grid-cols-2 gap-2.5">
            {CONTRACT_CATEGORIES.map((c) => (
              <ChipButton key={c} selected={contractCategory === c} onClick={() => onContractCategoryChange(c)} label={c} />
            ))}
          </div>
          {contractCategory === "리스" && (
            <p className="mt-2 rounded-[10px] bg-[#F8FAFC] p-2.5 text-[12px] leading-relaxed text-text-muted">
              리스 견적은 임시 데이터 기준이에요. 실제 금융사 조건과 다를 수 있어요.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted">계약기간</p>
          <div className="grid grid-cols-3 gap-2.5">
            {CONTRACT_MONTHS.map((m) => (
              <ChipButton key={m} selected={contractMonths === m} onClick={() => onContractMonthsChange(m)} label={`${m}개월`} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted">연간 약정거리</p>
          <div className="grid grid-cols-3 gap-2.5">
            {ANNUAL_MILEAGES.map((m) => (
              <ChipButton key={m} selected={annualMileage === m} onClick={() => onAnnualMileageChange(m)} label={`연 ${(m / 10000).toFixed(0)}만km`} />
            ))}
          </div>
        </div>
      </section>
      </motion.div>
      )}

      {/* ─── 에러 ─── */}
      {error && (
        <div className="flex items-start gap-2 rounded-[14px] border border-status-danger/20 bg-status-danger-soft p-4 text-[13px] text-status-danger">
          <p>{error}</p>
        </div>
      )}

      {/* ─── 하단 CTA ─── */}
      <FixedCTA
        onClick={onCalculate}
        disabled={!canCalculate}
        loading={isLoading}
        label={ctaLabel}
        icon={<Calculator size={16} strokeWidth={2.2} />}
        onPrev={onPrev}
      />
    </motion.section>
  );
}

// ─── 공용 ─────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-[16px] font-extrabold text-text-strong">{title}</h3>;
}

function ChipButton({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[52px] items-center justify-center rounded-[14px] text-[14.5px] font-bold transition-all duration-150",
        selected
          ? "bg-brand-soft text-brand ring-[1.5px] ring-brand"
          : "bg-[#F8FAFC] text-text-body ring-[1.5px] ring-transparent hover:ring-[#E5E8EB]"
      )}
    >
      {label}
    </button>
  );
}

function FixedCTA({
  onClick,
  disabled,
  loading,
  label,
  icon,
  onPrev,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
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
          disabled={disabled}
          className={cn(
            "flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold transition-all active:scale-[0.99]",
            disabled
              ? "cursor-not-allowed bg-[#E5E8EB] text-text-muted"
              : "bg-brand text-white shadow-[0_4px_12px_rgba(39,54,138,0.18)] hover:bg-brand-pressed"
          )}
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              계산 중...
            </>
          ) : (
            <>
              {icon}
              {label}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
