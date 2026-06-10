"use client";

import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VehicleColorPublic {
  id: string;
  kind: "EXTERIOR" | "INTERIOR";
  name: string;
  hexCode: string;
  imageUrl: string | null;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
}

interface ColorSelectorProps {
  colors: VehicleColorPublic[];
  exteriorColorId: string | null;
  interiorColorId: string | null;
  onChange: (kind: "EXTERIOR" | "INTERIOR", colorId: string | null) => void;
}

function formatPriceDelta(delta: number): string {
  if (delta <= 0) return "기본";
  if (delta % 10000 === 0) return `+${(delta / 10000).toLocaleString()}만원`;
  return `+${delta.toLocaleString()}원`;
}

function ColorSection({
  title,
  colors,
  selectedId,
  onSelect,
}: {
  title: string;
  colors: VehicleColorPublic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (colors.length === 0) {
    return (
      <div>
        <p className="text-[12px] font-medium text-ink-caption mb-2 uppercase tracking-wide">
          {title}
        </p>
        <p className="text-[12px] text-ink-caption">등록된 색상이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-medium text-ink-caption mb-2 uppercase tracking-wide">
        {title}
      </p>
      {/* 컨테이너 폭과 무관하게 카드 최소 150px 보장 — 좁은 비교 패널에서 색상명이 잘리지 않게 */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
        {colors.map((c) => {
          const isSelected = selectedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 p-3 rounded-btn border text-left transition-all duration-150",
                isSelected
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                  : "border-neutral-800 bg-white hover:border-secondary-400"
              )}
            >
              <div className="flex items-center gap-2.5 w-full">
                <div className="relative shrink-0">
                  <div
                    className="w-9 h-9 rounded-full border-2 border-white shadow-md"
                    style={{ background: c.hexCode }}
                  />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check size={10} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    title={c.name}
                    className={cn(
                      // 색상명은 잘리면 식별 불가 — 한 줄 말줄임 대신 어절 단위 2줄 줄바꿈 허용
                      // (어절이 너비를 넘으면 overflow-wrap 으로 글자 단위 줄바꿈 폴백)
                      "text-[13px] font-bold leading-snug break-keep [overflow-wrap:anywhere] line-clamp-2",
                      isSelected ? "text-primary" : "text-ink"
                    )}
                  >
                    {c.name}
                  </p>
                  <p className="text-[11px] text-ink-caption tabular-nums">
                    {formatPriceDelta(c.priceDelta)}
                  </p>
                </div>
              </div>
              {c.imageUrl && (
                <div className="w-full h-16 rounded-md bg-neutral-50 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ColorSelector({
  colors,
  exteriorColorId,
  interiorColorId,
  onChange,
}: ColorSelectorProps) {
  const exteriors = colors.filter((c) => c.kind === "EXTERIOR");
  const interiors = colors.filter((c) => c.kind === "INTERIOR");

  if (exteriors.length === 0 && interiors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5 p-5 bg-white rounded-card border border-neutral-700">
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-primary" />
        <h3 className="text-[15px] font-bold text-ink">색상 선택</h3>
      </div>
      {exteriors.length > 0 && (
        <ColorSection
          title="외장 색상"
          colors={exteriors}
          selectedId={exteriorColorId}
          onSelect={(id) => onChange("EXTERIOR", id)}
        />
      )}
      {interiors.length > 0 && (
        <ColorSection
          title="내장 색상"
          colors={interiors}
          selectedId={interiorColorId}
          onSelect={(id) => onChange("INTERIOR", id)}
        />
      )}
    </div>
  );
}
