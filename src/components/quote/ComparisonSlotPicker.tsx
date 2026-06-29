"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { SelectRow, type SelectOption } from "./primitives";
import type { VehicleListItem } from "@/types/api";
import { useBrandSignals } from "@/lib/use-brand-signals";
import { sortLineups } from "@/lib/lineup-sort";

export interface TrimOption {
  id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  isAccessory: boolean;
  isDefault: boolean;
}

export interface TrimData {
  id: string;
  name: string;
  price: number;
  engineType: string;
  fuelEfficiency: number | null;
  isDefault: boolean;
  specs: Record<string, string> | null;
  options: TrimOption[];
}

export interface ComparisonSelection {
  slug: string;
  trimId: string;
  trimPrice: number;
}

interface ComparisonSlotPickerProps {
  allVehicles: VehicleListItem[];
  excludeSlug?: string;
  value: ComparisonSelection | null;
  onChange: (selection: ComparisonSelection | null) => void;
  onRemove: () => void;
}

export function ComparisonSlotPicker({
  allVehicles,
  excludeSlug,
  value,
  onChange,
  onRemove,
}: ComparisonSlotPickerProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>(value?.slug ?? "");
  const [trims, setTrims] = useState<TrimData[]>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  const [selectedLineup, setSelectedLineup] = useState<string | null>(null);
  const [selectedTrimId, setSelectedTrimId] = useState<string | null>(null);
  const { comparator: brandComparator } = useBrandSignals();

  // 현재 차량 제외한 선택 가능 목록
  // 어드민/공개 일관 정렬 SSOT: isFeatured → 차량 수 → 가나다
  const vehicleOptions: SelectOption[] = useMemo(
    () =>
      [...allVehicles]
        .filter((v) => v.slug !== excludeSlug)
        .sort((a, b) => {
          const brandDiff = brandComparator(a.brand, b.brand);
          if (brandDiff !== 0) return brandDiff;
          return a.name.localeCompare(b.name, "ko");
        })
        .map((v) => ({
          value: v.slug,
          label: `${v.brand} ${v.name}`,
        })),
    [allVehicles, excludeSlug, brandComparator],
  );

  // 차량 선택 시 트림 로드
  useEffect(() => {
    if (!selectedSlug) {
      return;
    }

    let aborted = false;

    async function fetchTrims() {
      setTrimsLoading(true);
      setTrims([]);
      setSelectedLineup(null);
      setSelectedTrimId(null);

      try {
        const response = await fetch(`/api/vehicles/${selectedSlug}/trims`);
        const json = await response.json();
        if (aborted) return;
        if (!json.success || !Array.isArray(json.data)) return;
        setTrims(json.data as TrimData[]);
      } catch {
        // Keep the picker empty on trim fetch failure.
      } finally {
        if (!aborted) setTrimsLoading(false);
      }
    }

    void fetchTrims();

    return () => {
      aborted = true;
    };
  }, [selectedSlug]);

  // 캐스케이딩 파생값 (QuoteClientPage와 동일 로직)
  const hasCascade = trims.some((t) => t.specs?.lineup);

  const availableLineups = useMemo(() => {
    if (!hasCascade) return [];
    return sortLineups([
      ...new Set(trims.map((t) => t.specs?.lineup ?? "").filter(Boolean)),
    ]);
  }, [trims, hasCascade]);

  const trimsForLineup = useMemo(
    () =>
      selectedLineup
        ? trims.filter((t) => t.specs?.lineup === selectedLineup)
        : [],
    [trims, selectedLineup],
  );

  // 트림 옵션 — id 기반 식별 (같은 specs.trimName 중복 차량 대응).
  // 같은 이름이 여러 개면 t.name의 prefix 차이를 보조 라벨로 자동 표시.
  const availableTrimNames = useMemo(() => {
    const list = trimsForLineup.map((t) => {
      const trimName = t.specs?.trimName ?? t.name;
      const extra =
        t.name !== trimName && t.name.includes(trimName)
          ? t.name.replace(trimName, "").trim().replace(/\s+/g, " ")
          : null;
      return { id: t.id, name: trimName, extra, price: t.price };
    });
    const nameCount = new Map<string, number>();
    list.forEach((it) => nameCount.set(it.name, (nameCount.get(it.name) ?? 0) + 1));
    return list.map((it) => ({
      ...it,
      extra: nameCount.get(it.name)! > 1 ? it.extra : null,
    }));
  }, [trimsForLineup]);

  const resolvedTrim = useMemo(() => {
    if (hasCascade) {
      if (!selectedTrimId) return null;
      return trimsForLineup.find((t) => t.id === selectedTrimId) ?? null;
    }
    return trims.find((t) => t.id === selectedLineup) ?? null;
  }, [hasCascade, selectedTrimId, trimsForLineup, trims, selectedLineup]);

  // 트림 확정 시 부모에 통지
  useEffect(() => {
    if (resolvedTrim && selectedSlug) {
      onChange({
        slug: selectedSlug,
        trimId: resolvedTrim.id,
        trimPrice: resolvedTrim.price,
      });
    } else {
      onChange(null);
    }
  }, [resolvedTrim, selectedSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-white rounded-card border border-line2 shadow-soft p-4 md:p-5">
      <div className="flex items-start gap-2 mb-3">
        <span className="text-[12px] font-bold text-brand bg-brand-soft px-2 py-0.5 rounded-[6px]">
          비교 차량
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="비교 차량 제거"
          className="ml-auto w-7 h-7 flex items-center justify-center rounded-full text-ink-caption hover:bg-sec hover:text-ink transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-3">
        <SelectRow
          label="차량"
          value={selectedSlug}
          placeholder="비교할 차량을 선택하세요"
          options={vehicleOptions}
	          onChange={(v) => {
	            setSelectedSlug(v);
	            setTrims([]);
	            setSelectedLineup(null);
	            setSelectedTrimId(null);
	          }}
        />

        {selectedSlug && trimsLoading && (
          <div className="flex items-center gap-2 text-[13px] text-ink-caption">
            <span className="w-3.5 h-3.5 border-2 border-line2 border-t-brand rounded-full animate-spin" />
            트림 정보 불러오는 중...
          </div>
        )}

        {selectedSlug && !trimsLoading && trims.length > 0 && (
          <>
            {hasCascade ? (
              <>
                <SelectRow
                  label="라인업"
                  value={selectedLineup ?? ""}
                  placeholder="연식 / 엔진"
                  options={availableLineups.map((l) => ({ value: l, label: l }))}
                  onChange={(v) => {
                    setSelectedLineup(v || null);
                    setSelectedTrimId(null);
                  }}
                />
                {selectedLineup && (
                  <SelectRow
                    label="트림"
                    value={selectedTrimId ?? ""}
                    placeholder="트림을 선택하세요"
                    options={availableTrimNames.map((t) => {
                      const baseLabel = t.extra ? `${t.name} (${t.extra})` : t.name;
                      return {
                        value: t.id,
                        label: `${baseLabel} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                      };
                    })}
                    onChange={(v) => setSelectedTrimId(v || null)}
                  />
                )}
              </>
            ) : (
              <SelectRow
                label="트림"
                value={selectedLineup ?? ""}
                placeholder="트림을 선택하세요"
                options={trims.map((t) => ({
                  value: t.id,
                  label: `${t.name} — ${Math.round(t.price / 10000).toLocaleString()}만원`,
                }))}
                onChange={(v) => setSelectedLineup(v || null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
