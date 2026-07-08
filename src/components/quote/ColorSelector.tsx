"use client";

import type { ReactNode } from "react";
import { Palette } from "lucide-react";
import { SelectSheet, type SelectOption } from "@/app/(public)/quote/SelectSheet";

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

function fmtMan(v: number) {
  return `${Math.round(v / 10000).toLocaleString()}만원`;
}

function colorHint(priceDelta: number): string {
  return priceDelta > 0 ? `+${fmtMan(priceDelta)}` : "기본";
}

function colorLeading(hexCode: string): ReactNode {
  return (
    <span
      aria-hidden
      className="block h-7 w-7 rounded-full border border-[#E5E8EB]"
      style={{ background: hexCode }}
    />
  );
}

function colorTriggerLeading(
  colors: readonly VehicleColorPublic[],
  colorId: string | null,
): ReactNode {
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
}

/**
 * 색상 선택 — Step2ConditionV2와 동일한 토스풍 SelectSheet(바텀시트) 기반.
 * 외장/내장 각각 별도 SelectSheet로 렌더링.
 */
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

  const exteriorOptions: SelectOption[] = exteriors.map((c) => ({
    value: c.id,
    label: c.name,
    hint: colorHint(c.priceDelta),
    leading: colorLeading(c.hexCode),
  }));

  const interiorOptions: SelectOption[] = interiors.map((c) => ({
    value: c.id,
    label: c.name,
    hint: colorHint(c.priceDelta),
    leading: colorLeading(c.hexCode),
  }));

  return (
    <div className="space-y-3 rounded-[20px] border border-border-subtle bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-brand" />
        <h3 className="text-[15px] font-bold text-text-strong">색상 선택</h3>
      </div>
      {exteriors.length > 0 && (
        <SelectSheet
          id="color-selector-exterior"
          label="외장 색상"
          placeholder="외장 색상을 선택하세요"
          value={exteriorColorId}
          options={exteriorOptions}
          onChange={(v) => onChange("EXTERIOR", v)}
          triggerLeading={(v) => colorTriggerLeading(exteriors, v)}
          sheetTitle="외장 색상 선택"
        />
      )}
      {interiors.length > 0 && (
        <SelectSheet
          id="color-selector-interior"
          label="내장 색상"
          placeholder="내장 색상을 선택하세요"
          value={interiorColorId}
          options={interiorOptions}
          onChange={(v) => onChange("INTERIOR", v)}
          triggerLeading={(v) => colorTriggerLeading(interiors, v)}
          sheetTitle="내장 색상 선택"
        />
      )}
    </div>
  );
}
