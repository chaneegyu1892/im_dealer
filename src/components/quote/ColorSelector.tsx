"use client";

import { ChevronDown, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VehicleColorPublic {
  readonly id: string;
  readonly kind: "EXTERIOR" | "INTERIOR";
  readonly name: string;
  readonly hexCode: string;
  readonly imageUrl: string | null;
  readonly priceDelta: number;
  readonly isDefault: boolean;
  readonly sortOrder: number;
}

interface ColorSelectorProps {
  readonly colors: readonly VehicleColorPublic[];
  readonly exteriorColorId: string | null;
  readonly interiorColorId: string | null;
  readonly onChange: (kind: "EXTERIOR" | "INTERIOR", colorId: string | null) => void;
}

interface ColorSectionProps {
  readonly kind: VehicleColorPublic["kind"];
  readonly title: string;
  readonly colors: readonly VehicleColorPublic[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

function formatPriceDelta(delta: number): string {
  if (delta <= 0) return "기본";
  if (delta % 10000 === 0) return `+${(delta / 10000).toLocaleString()}만원`;
  return `+${delta.toLocaleString()}원`;
}

function colorOptionLabel(color: VehicleColorPublic): string {
  return `${color.name} · ${formatPriceDelta(color.priceDelta)}`;
}

function ColorSection({
  kind,
  title,
  colors,
  selectedId,
  onSelect,
}: ColorSectionProps) {
  const selectedColor = colors.find((color) => color.id === selectedId) ?? null;
  const fieldId = `color-selector-${kind.toLowerCase()}`;
  const label = `${title} 선택`;

  if (colors.length === 0) {
    return (
      <div>
        <p className="public-quiet-label mb-1.5">
          {title}
        </p>
        <p className="text-[12px] text-public-muted">등록된 색상이 없습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={fieldId} className="public-quiet-label">
        {title}
      </label>
      <div className="relative mt-2">
        {selectedColor && (
          <span
            aria-label={`선택된 ${title} 미리보기: ${selectedColor.name}`}
            className="pointer-events-none absolute left-4 top-1/2 z-10 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-surface shadow-card ring-1 ring-border-subtle"
            style={{ background: selectedColor.hexCode }}
          />
        )}
        <select
          id={fieldId}
          aria-label={label}
          value={selectedColor?.id ?? ""}
          onChange={(event) => {
            if (event.currentTarget.value) onSelect(event.currentTarget.value);
          }}
          className={cn(
            "min-h-[48px] w-full cursor-pointer appearance-none rounded-[16px] border border-border-strong bg-surface py-3 pr-11 text-[14px] font-bold text-text-strong shadow-card transition-colors duration-state hover:border-brand/40 focus:border-brand focus:outline-none focus:ring-4 focus:ring-focus-ring/20",
            selectedColor ? "pl-14" : "pl-4"
          )}
        >
          <option value="" disabled>
            {title}을 선택하세요
          </option>
          {colors.map((color) => (
            <option key={color.id} value={color.id}>
              {colorOptionLabel(color)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand"
        />
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
    <div className="space-y-4 rounded-[20px] border border-border-subtle bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-brand" />
        <h3 className="text-[15px] font-bold text-text-strong">색상 선택</h3>
      </div>
      {exteriors.length > 0 && (
        <ColorSection
          kind="EXTERIOR"
          title="외장 색상"
          colors={exteriors}
          selectedId={exteriorColorId}
          onSelect={(id) => onChange("EXTERIOR", id)}
        />
      )}
      {interiors.length > 0 && (
        <ColorSection
          kind="INTERIOR"
          title="내장 색상"
          colors={interiors}
          selectedId={interiorColorId}
          onSelect={(id) => onChange("INTERIOR", id)}
        />
      )}
    </div>
  );
}
