"use client";

import type { Dispatch, SetStateAction } from "react";
import type { BasicInfoFormData } from "./BasicInfoCoreFields";

interface BasicInfoFlagsProps {
  readonly data: BasicInfoFormData;
  readonly setData: Dispatch<SetStateAction<BasicInfoFormData>>;
}

const INPUT_CLASS =
  "w-full rounded-[6px] border border-[#E8EAF0] bg-[#F8F9FC] px-3 py-2 text-[13px] text-[#1A1A2E] outline-none transition-colors focus:border-[#000666] focus:bg-white";
const TRI_OPTIONS = [
  { label: "자동", value: null },
  { label: "있음", value: true },
  { label: "없음", value: false },
] as const;

export function BasicInfoFlags({ data, setData }: BasicInfoFlagsProps) {
  return (
    <section className="space-y-4 rounded-[12px] border border-[#E8EAF0] bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-[15px] font-bold text-[#1A1A2E]">기타 설정</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="vehicle-code" label="차량 코드">
          <input id="vehicle-code" value={data.vehicleCode} onChange={(event) => setData((current) => ({ ...current, vehicleCode: event.target.value }))} className={INPUT_CLASS} />
        </Field>
        <Field id="vehicle-surcharge" label="가산율 (%)">
          <input id="vehicle-surcharge" type="number" step="0.01" value={data.surchargeRate} onChange={(event) => setData((current) => ({ ...current, surchargeRate: Number(event.target.value) }))} className={INPUT_CLASS} />
        </Field>
        <Field id="vehicle-order" label="노출 순서">
          <input id="vehicle-order" type="number" value={data.displayOrder} onChange={(event) => setData((current) => ({ ...current, displayOrder: Number(event.target.value) }))} className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
        <Check label="노출 여부" checked={data.isVisible} onChange={(checked) => setData((current) => ({ ...current, isVisible: checked }))} />
        <Check label="인기 차량" checked={data.isPopular} onChange={(checked) => setData((current) => ({ ...current, isPopular: checked }))} />
        <Check label="주목 차량 (탐색 슬라이더)" checked={data.isSpotlight} onChange={(checked) => setData((current) => ({ ...current, isSpotlight: checked }))} />
      </div>
      <div className="space-y-3 border-t border-[#E8EAF0] pt-3">
        <p className="text-[12px] font-semibold text-[#4A5270]">추천 속성 보정 (자동검출 override)</p>
        <div className="flex flex-wrap gap-6">
          <TriToggle label="슬라이딩 도어" value={data.slidingDoorOverride} onChange={(value) => setData((current) => ({ ...current, slidingDoorOverride: value }))} />
          <TriToggle label="고급 안전사양" value={data.advancedSafetyOverride} onChange={(value) => setData((current) => ({ ...current, advancedSafetyOverride: value }))} />
        </div>
      </div>
    </section>
  );
}

function Field({ id, label, children }: { readonly id: string; readonly label: string; readonly children: React.ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={id} className="text-[12px] font-semibold text-[#4A5270]">{label}</label>{children}</div>;
}

function Check({ label, checked, onChange }: { readonly label: string; readonly checked: boolean; readonly onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-[#4A5270]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[#000666]" />{label}</label>;
}

function TriToggle({ label, value, onChange }: { readonly label: string; readonly value: boolean | null; readonly onChange: (value: boolean | null) => void }) {
  return <fieldset className="space-y-1"><legend className="text-[12px] font-medium text-[#1A1A2E]">{label}</legend><div className="flex gap-1">{TRI_OPTIONS.map((option) => <button key={option.label} type="button" onClick={() => onChange(option.value)} aria-pressed={value === option.value} className={value === option.value ? "min-h-9 rounded-md bg-[#000666] px-3 text-[12px] font-medium text-white" : "min-h-9 rounded-md border border-[#E5E8F0] bg-white px-3 text-[12px] font-medium text-[#9BA4C0] transition-colors hover:border-[#000666] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE]"}>{option.label}</button>)}</div></fieldset>;
}
