"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, X, Check, Search, Car, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrimGroupSelect } from "./TrimGroupSelect";
import type { VehicleListItem } from "@/types/api";
import type { VehicleColorPublic } from "./ColorSelector";
import { ColorSelector } from "./ColorSelector";

// ─── 공용 타입 ────────────────────────────────────────────────
export interface ComparisonTrimOption {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  isDefault: boolean;
  isAccessory: boolean;
}

export interface ComparisonTrimData {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  engineType: string;
  fuelEfficiency?: number | null;
  isDefault: boolean;
  specs?: Record<string, string> | null;
  options: ComparisonTrimOption[];
  lineupId?: string | null;
  lineup?: { id: string; name: string } | null;
}

// ─── Props ───────────────────────────────────────────────────
interface VehicleConfigPanelProps {
  mode: "primary" | "comparison";

  // 현재 차량 (primary 모드)
  vehicleBrand?: string;
  vehicleName?: string;
  thumbnailUrl?: string;

  // 비교 차량 선택 (comparison 모드)
  allVehicles?: VehicleListItem[];
  excludeSlug?: string;
  selectedSlug?: string;
  onVehicleChange?: (slug: string) => void;

  // 트림
  trims: ComparisonTrimData[];
  trimsLoading?: boolean;
  selectedTrimId: string | null;
  onTrimChange: (trimId: string | null) => void;

  // 옵션
  selectedOptionIds: Set<string>;
  onOptionToggle: (optId: string) => void;
  onOptionsClear: () => void;

  // 색상
  colors?: VehicleColorPublic[];
  exteriorColorId?: string | null;
  interiorColorId?: string | null;
  onColorChange?: (kind: "EXTERIOR" | "INTERIOR", id: string | null) => void;

  // 계약 유형 (패널별 독립 설정)
  productType?: "장기렌트" | "리스";
  onProductTypeChange?: (v: "장기렌트" | "리스") => void;

  // 현재 차량 복사 버튼 (comparison 모드)
  primarySlug?: string;
  onCopyPrimary?: () => void;
}

// ─── 포맷 ────────────────────────────────────────────────────
function fmtMan(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

// ─── 차량 선택 모달 ──────────────────────────────────────────
function VehiclePickerModal({
  vehicles,
  excludeSlug,
  selectedSlug,
  onSelect,
  onClose,
}: {
  vehicles: VehicleListItem[];
  excludeSlug?: string;
  selectedSlug?: string;
  onSelect: (slug: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const list = vehicles.filter((v) => v.slug !== excludeSlug);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q)
    );
  }, [vehicles, excludeSlug, query]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 백드롭 */}
      <motion.div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 본체 */}
      <motion.div
        className="relative bg-white w-full md:max-w-[600px] rounded-t-[20px] md:rounded-[16px] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 280 }}
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-5 pb-4 pt-5">
          <div>
            <p className="text-[16px] font-bold text-text-strong">비교 차량 선택</p>
            <p className="mt-0.5 text-[12px] text-text-muted">비교하고 싶은 차량을 선택하세요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-soft"
          >
            <X size={18} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="차량 이름으로 검색..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] bg-sec border border-line2 rounded-[10px] outline-none focus:border-brand focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* 차량 그리드 */}
        <div className="overflow-y-auto flex-1 px-4 pb-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Car size={32} className="mb-3 opacity-40" />
              <p className="text-[13px]">검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((v) => {
                const isSelected = v.slug === selectedSlug;
                return (
                  <motion.button
                    key={v.slug}
                    type="button"
                    onClick={() => {
                      onSelect(v.slug);
                      onClose();
                    }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "relative rounded-[12px] border-2 overflow-hidden text-left transition-all",
                      isSelected
                        ? "border-brand shadow-lift"
                        : "border-border-subtle hover:border-border-strong"
                    )}
                  >
                    {/* 차량 이미지 */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-soft">
                      {v.thumbnailUrl ? (
                        <Image
                          src={v.thumbnailUrl}
                          alt={v.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, 180px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car size={28} className="text-border-strong" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 bg-brand/10 flex items-center justify-center">
                          <div className="w-7 h-7 bg-brand rounded-full flex items-center justify-center shadow">
                            <Check size={14} strokeWidth={3} className="text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 차량 정보 */}
                    <div className="px-2.5 py-2">
                      <p className="mb-0.5 text-[10px] leading-none text-text-muted">{v.brand}</p>
                      <p className={cn(
                        "text-[13px] font-bold leading-snug",
                        isSelected ? "text-brand" : "text-text-strong"
                      )}>
                        {v.name}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 옵션 아코디언 ───────────────────────────────────────────
function OptionsAccordion({
  options,
  selectedOptionIds,
  onToggle,
}: {
  options: ComparisonTrimOption[];
  selectedOptionIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, ComparisonTrimOption[]>();
    for (const opt of options) {
      const cat = opt.category ?? "기타 옵션";
      const arr = map.get(cat) ?? [];
      arr.push(opt);
      map.set(cat, arr);
    }
    return map;
  }, [options]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const [cat, opts] of Array.from(groups.entries())) {
      if (opts.some((o) => selectedOptionIds.has(o.id))) initial.add(cat);
    }
    return initial;
  });

  const toggle = (cat: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });

  if (groups.size === 0) return null;

  return (
    <div className="space-y-1.5">
      {Array.from(groups.entries()).map(([cat, opts]) => {
        const isOpen = expanded.has(cat);
        const selectedCount = opts.filter((o) => selectedOptionIds.has(o.id)).length;
        return (
          <div key={cat} className="overflow-hidden rounded-[8px] border border-border-subtle">
            <button
              type="button"
              onClick={() => toggle(cat)}
              className="flex w-full items-center justify-between bg-surface-soft px-3 py-2.5 transition-colors hover:bg-border-subtle/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-[12px] font-semibold text-text-body">{cat}</span>
                {selectedCount > 0 && (
                  <span className="shrink-0 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-surface">
                    {selectedCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[11px] text-text-muted">{opts.length}개</span>
                <ChevronDown
                  size={14}
                  className={cn("text-text-muted transition-transform duration-200", isOpen && "rotate-180")}
                />
              </div>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-border-subtle">
                    {opts.map((opt) => {
                      const isSelected = selectedOptionIds.has(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onToggle(opt.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                            isSelected ? "bg-brand-soft hover:bg-brand-soft/80" : "bg-surface hover:bg-surface-soft"
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors",
                              isSelected ? "border-brand bg-brand" : "border-border-strong bg-surface"
                            )}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} className="text-surface" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-[12px] font-medium leading-snug text-text-strong">{opt.name}</p>
                            {opt.description && (
                              <p className="mt-0.5 truncate text-[11px] text-text-muted">{opt.description}</p>
                            )}
                          </div>
                          <span className={cn("shrink-0 text-[12px] font-bold", isSelected ? "text-brand" : "text-text-body")}>
                            +{fmtMan(opt.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}


// ─── 메인 컴포넌트 ────────────────────────────────────────────
export function VehicleConfigPanel({
  mode,
  vehicleBrand,
  vehicleName,
  thumbnailUrl,
  allVehicles = [],
  excludeSlug,
  selectedSlug = "",
  onVehicleChange,
  trims,
  trimsLoading = false,
  selectedTrimId,
  onTrimChange,
  selectedOptionIds,
  onOptionToggle,
  onOptionsClear,
  colors = [],
  exteriorColorId = null,
  interiorColorId = null,
  onColorChange,
  productType,
  onProductTypeChange,
  onCopyPrimary,
}: VehicleConfigPanelProps) {
  const isPrimary = mode === "primary";
  const [showPicker, setShowPicker] = useState(false);

  const selectedTrim = useMemo(
    () => trims.find((t) => t.id === selectedTrimId) ?? null,
    [trims, selectedTrimId]
  );

  const optionsTotalPrice = useMemo(
    () =>
      selectedTrim?.options
        .filter((o) => selectedOptionIds.has(o.id))
        .reduce((sum, o) => sum + o.price, 0) ?? 0,
    [selectedTrim, selectedOptionIds]
  );

  const compVehicleMeta = allVehicles.find((v) => v.slug === selectedSlug);
  const displayBrand = isPrimary ? vehicleBrand : compVehicleMeta?.brand;
  const displayName = isPrimary ? vehicleName : compVehicleMeta?.name;
  const displayThumb = isPrimary ? thumbnailUrl : compVehicleMeta?.thumbnailUrl;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* ── 차량 헤더 이미지 ──────────────────────── */}
        {isPrimary ? (
          /* primary: 클릭 불가, 이미지 + 정보만 표시 */
          <div className="relative w-full overflow-hidden" style={{ height: 140 }}>
            <AnimatePresence mode="wait">
              {displayThumb ? (
                <motion.div
                  key={displayThumb}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <Image
                    src={displayThumb}
                    alt={displayName ?? "차량"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  className="absolute inset-0 flex items-center justify-center bg-surface-soft"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Car size={40} className="text-border-strong" />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
              <motion.div key={displayName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wider mb-0.5">현재 견적 차량</p>
                <p className="text-[11px] text-white/70">{displayBrand}</p>
                <p className="text-[15px] font-bold text-white leading-snug">{displayName}</p>
              </motion.div>
            </div>
          </div>
        ) : (
          /* comparison: 이미지 영역 전체가 차량 선택 버튼 */
          <motion.button
            type="button"
            onClick={() => setShowPicker(true)}
            whileTap={{ scale: 0.99 }}
            className="relative w-full overflow-hidden block"
            style={{ height: 140 }}
          >
            <AnimatePresence mode="wait">
              {displayThumb ? (
                /* 차량 선택됨 — 이미지 + 변경 오버레이 */
                <motion.div
                  key={displayThumb}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <Image
                    src={displayThumb}
                    alt={displayName ?? "차량"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  {/* 호버 시 변경 힌트 */}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span className="rounded-[8px] bg-surface/90 px-3 py-1.5 text-[12px] font-semibold text-text-strong opacity-0 shadow transition-opacity hover:opacity-100">
                      차량 변경
                    </span>
                  </div>
                </motion.div>
              ) : (
                /* 차량 미선택 — 클릭 유도 플레이스홀더 */
                <motion.div
                  key="empty"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-soft transition-colors hover:bg-border-subtle/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border-strong bg-surface">
                    <Car size={22} className="text-text-muted" />
                  </div>
                  <p className="text-[13px] font-semibold text-text-body">차량 선택하기</p>
                  <p className="text-[11px] text-text-muted">클릭하여 비교할 차량을 선택하세요</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 차량 선택됨: 차량 정보 오버레이 */}
            {displayName && (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-end justify-between pointer-events-none">
                <motion.div key={displayName} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
                  <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-0.5">비교 차량</p>
                  <p className="text-[11px] text-white/70">{displayBrand}</p>
                  <p className="text-[15px] font-bold text-white leading-snug">{displayName}</p>
                </motion.div>
                <span className="shrink-0 text-[11px] font-semibold text-white/80 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-[6px]">
                  클릭하여 변경
                </span>
              </div>
            )}
          </motion.button>
        )}

        {/* ── 본문 ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 트림 로딩 */}
          {trimsLoading && (
            <div className="flex items-center gap-2 py-4 text-[13px] text-text-muted">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border-subtle border-t-brand" />
              트림 정보 불러오는 중...
            </div>
          )}

          {/* 현재 차량 복사 버튼 (차량 미선택 시) */}
          {!isPrimary && !selectedSlug && !trimsLoading && onCopyPrimary && (
            <button
              type="button"
              onClick={onCopyPrimary}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-border-subtle bg-surface-soft py-2.5 text-[13px] text-text-body transition-colors hover:bg-border-subtle/50"
            >
              <Copy size={13} />
              현재 차량 그대로 비교하기
            </button>
          )}

          {/* 트림 선택 — 인라인 아코디언 (네이티브 select 는 펼침 위치 제어 불가로 차량 사진을 덮음) */}
          {trims.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">트림 선택</p>
              <TrimGroupSelect
                trims={trims}
                selectedTrimId={selectedTrimId ?? null}
                onChange={(trimId) => {
                  onTrimChange(trimId);
                  onOptionsClear();
                }}
              />
            </div>
          )}

          {/* 선택된 트림 요약 */}
          {selectedTrim && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-[8px] bg-surface-soft px-3 py-2 text-[12px]"
            >
              <span className="text-text-body">
                {selectedTrim.engineType}
                {selectedTrim.fuelEfficiency ? ` · 연비 ${selectedTrim.fuelEfficiency}km/L` : ""}
              </span>
              <span className="num font-bold text-text-strong">
                {fmtMan((selectedTrim.discountPrice ?? selectedTrim.price) + optionsTotalPrice)}
              </span>
            </motion.div>
          )}

          {/* 옵션 선택 */}
          {selectedTrim && selectedTrim.options.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  옵션 선택
                  <span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-text-muted">· 선택 사항</span>
                </p>
                {selectedOptionIds.size > 0 && (
                  <button
                    type="button"
                    onClick={onOptionsClear}
                    className="flex items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-status-danger"
                  >
                    <X size={11} />초기화
                  </button>
                )}
              </div>
              <OptionsAccordion
                options={selectedTrim.options}
                selectedOptionIds={selectedOptionIds}
                onToggle={onOptionToggle}
              />
              {optionsTotalPrice > 0 && (
                <p className="text-[12px] text-brand font-bold text-right">
                  옵션 +{fmtMan(optionsTotalPrice)}
                </p>
              )}
            </div>
          )}

          {/* 색상 선택 */}
          {selectedTrimId && colors.length > 0 && onColorChange && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <ColorSelector
                colors={colors}
                exteriorColorId={exteriorColorId ?? null}
                interiorColorId={interiorColorId ?? null}
                onChange={onColorChange}
              />
            </motion.div>
          )}

          {/* 계약 유형 (장기렌트 / 리스) */}
          {selectedTrimId && onProductTypeChange && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-1.5"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">계약 유형</p>
              <div className="grid grid-cols-2 gap-2">
                {(["장기렌트", "리스"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => onProductTypeChange(type)}
                    className={cn(
                      "py-2.5 px-3 rounded-[10px] border-2 text-[13px] font-bold transition-all",
                      productType === type
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border-subtle bg-surface text-text-body hover:border-brand/30"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

        </div>
      </div>

      {/* ── 차량 선택 모달 ──────────────────────────── */}
      <AnimatePresence>
        {showPicker && (
          <VehiclePickerModal
            vehicles={allVehicles}
            excludeSlug={excludeSlug}
            selectedSlug={selectedSlug}
            onSelect={(slug) => {
              onVehicleChange?.(slug);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
