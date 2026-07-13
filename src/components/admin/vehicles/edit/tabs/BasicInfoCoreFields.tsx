"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import type { VehicleCategory } from "@/types/vehicle";

export type BasicInfoFormData = {
  readonly name: string;
  readonly brand: string;
  readonly category: VehicleCategory;
  readonly basePrice: number;
  readonly description: string;
  readonly surchargeRate: number;
  readonly isVisible: boolean;
  readonly isPopular: boolean;
  readonly isSpotlight: boolean;
  readonly displayOrder: number;
  readonly vehicleCode: string;
  readonly slug: string;
  readonly slidingDoorOverride: boolean | null;
  readonly advancedSafetyOverride: boolean | null;
  readonly tags: readonly string[];
};

interface BasicInfoCoreFieldsProps {
  readonly data: BasicInfoFormData;
  readonly setData: Dispatch<SetStateAction<BasicInfoFormData>>;
}

const INPUT_CLASS =
  "w-full rounded-[6px] border border-[#E8EAF0] bg-[#F8F9FC] px-3 py-2 text-[13px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#B0B8D0] focus:border-[#000666] focus:bg-white";
const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer appearance-none`;
const BRANDS = ["현대", "기아", "제네시스", "KGM", "쉐보레", "르노"] as const;
const CATEGORIES = ["세단", "SUV", "밴", "트럭"] as const;

export function BasicInfoCoreFields({ data, setData }: BasicInfoCoreFieldsProps) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#+/, "").trim();
    if (!tag) return;
    setData((current) =>
      current.tags.includes(tag)
        ? current
        : { ...current, tags: [...current.tags, tag] }
    );
    setTagInput("");
  };

  const updateCategory = (value: string) => {
    const category = CATEGORIES.find((item) => item === value);
    if (category) setData((current) => ({ ...current, category }));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="vehicle-name" label="차량명" required>
          <input id="vehicle-name" value={data.name} onChange={(event) => setData((current) => ({ ...current, name: event.target.value }))} className={INPUT_CLASS} />
        </Field>
        <Field id="vehicle-brand" label="브랜드" required>
          <select id="vehicle-brand" value={data.brand} onChange={(event) => setData((current) => ({ ...current, brand: event.target.value }))} className={SELECT_CLASS}>
            {BRANDS.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="vehicle-category" label="분류" required>
          <select id="vehicle-category" value={data.category} onChange={(event) => updateCategory(event.target.value)} className={SELECT_CLASS}>
            {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </Field>
        <Field id="vehicle-base-price" label="기본 가격 (만원)" required>
          <input id="vehicle-base-price" type="number" value={data.basePrice / 10_000} onChange={(event) => setData((current) => ({ ...current, basePrice: Number(event.target.value) * 10_000 }))} className={INPUT_CLASS} />
        </Field>
      </div>
      <Field id="vehicle-description" label="한줄 홍보 문구">
        <input id="vehicle-description" value={data.description} onChange={(event) => setData((current) => ({ ...current, description: event.target.value }))} className={INPUT_CLASS} placeholder="예: 압도적인 품격과 가치" />
      </Field>
      <Field id="vehicle-slug" label="슬러그">
        <input id="vehicle-slug" value={data.slug} onChange={(event) => setData((current) => ({ ...current, slug: event.target.value }))} className={INPUT_CLASS} />
      </Field>
      <Field id="vehicle-tag" label="특징 태그">
        <p className="text-[12px] leading-5 text-[#9BA4C0]">비워두면 해시태그를 자동으로 보정합니다.</p>
        <div className="flex gap-2">
          <input id="vehicle-tag" value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="예: 프리미엄 (Enter로 추가)" className={INPUT_CLASS} />
          <button type="button" onClick={addTag} aria-label="태그 추가" className="flex min-h-11 min-w-11 items-center justify-center rounded-[6px] bg-[#000666] text-white transition-colors hover:bg-[#1A1A6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE]">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {data.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{data.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-[6px] bg-[#EEF0FF] px-2 py-1 text-[12px] font-semibold text-[#000666]">#{tag}<button type="button" onClick={() => setData((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }))} aria-label={`${tag} 태그 제거`} className="min-h-6 min-w-6 text-[#6066EE] hover:text-[#000666]"><X size={12} aria-hidden="true" /></button></span>
        ))}</div>}
      </Field>
    </div>
  );
}

function Field({ id, label, children, required = false }: { readonly id: string; readonly label: string; readonly children: React.ReactNode; readonly required?: boolean }) {
  return <div className="space-y-1.5"><label htmlFor={id} className="flex items-center gap-1 text-[12px] font-semibold text-[#4A5270]">{label}{required && <span className="text-red-500">*</span>}</label>{children}</div>;
}
