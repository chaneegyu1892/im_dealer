"use client";

import { Image as ImageIcon, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail } from "@/types/admin";
import type { VehicleCategory } from "@/types/vehicle";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
  기아: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
};

function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export interface VehicleEditData {
  brand: string;
  name: string;
  category: VehicleCategory;
  basePrice: number;
  description: string;
  thumbnailUrl: string;
  imageUrls: string[];
  surchargeRate: number;
  isVisible: boolean;
  isPopular: boolean;
  displayOrder: number;
  vehicleCode: string;
  slug: string;
}

interface VehicleInfoFormProps {
  vehicle: AdminVehicleDetail;
  editData: VehicleEditData;
  onChange: (data: VehicleEditData) => void;
}

export function VehicleInfoForm({ vehicle, editData, onChange }: VehicleInfoFormProps) {
  // imageUrls 개별 항목 수정
  const handleImageUrlChange = (index: number, value: string) => {
    const updated = editData.imageUrls.map((url, i) => (i === index ? value : url));
    onChange({ ...editData, imageUrls: updated });
  };

  const handleImageUrlAdd = () => {
    onChange({ ...editData, imageUrls: [...editData.imageUrls, ""] });
  };

  const handleImageUrlRemove = (index: number) => {
    onChange({ ...editData, imageUrls: editData.imageUrls.filter((_, i) => i !== index) });
  };

  const previewUrl = editData.thumbnailUrl || editData.imageUrls[0];

  return (
    <div className="bg-white rounded-[14px] border border-[#E8EAF0] overflow-hidden shadow-sm">
      {/* 썸네일 미리보기 */}
      <div
        className="h-[180px] relative flex items-center justify-center"
        style={{
          background: previewUrl ? undefined : (BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"]),
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt={vehicle.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-white/40 flex flex-col items-center gap-2">
            <ImageIcon size={32} />
            <span className="text-[12px]">이미지 없음</span>
          </div>
        )}
      </div>

      {/* 폼 필드 */}
      <div className="p-5 space-y-4">

        {/* 차량명 + 카테고리 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="차량명" required>
            <input
              value={editData.name}
              onChange={(e) => onChange({ ...editData, name: e.target.value })}
              className={inputClass}
            />
          </FormField>
          <FormField label="분류" required>
            <select
              value={editData.category}
              onChange={(e) => onChange({ ...editData, category: e.target.value as VehicleCategory })}
              className={selectClass}
            >
              {(["세단", "SUV", "밴", "트럭"] as VehicleCategory[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>
        </div>

        {/* 브랜드 + 기준가 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="브랜드">
            <input value={editData.brand} disabled className={cn(inputClass, "opacity-70")} />
          </FormField>
          <FormField label="기준 가격 (만원)" required>
            <input
              type="number"
              value={editData.basePrice / 10000}
              onChange={(e) => onChange({ ...editData, basePrice: Number(e.target.value) * 10000 })}
              className={inputClass}
            />
          </FormField>
        </div>

        {/* 차량 코드 + 가산율 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="차량 코드">
            <input
              value={editData.vehicleCode}
              onChange={(e) => onChange({ ...editData, vehicleCode: e.target.value })}
              className={inputClass}
              placeholder="예: K5"
            />
          </FormField>
          <FormField label="차량 가산율 (%)">
            <input
              type="number"
              step="0.01"
              value={editData.surchargeRate}
              onChange={(e) => onChange({ ...editData, surchargeRate: Number(e.target.value) })}
              className={inputClass}
            />
          </FormField>
        </div>

        {/* Slug + 노출 순서 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Slug">
            <input
              value={editData.slug}
              onChange={(e) => onChange({ ...editData, slug: e.target.value })}
              className={inputClass}
              placeholder="예: kia-k5"
            />
          </FormField>
          <FormField label="노출 순서">
            <input
              type="number"
              value={editData.displayOrder}
              onChange={(e) => onChange({ ...editData, displayOrder: Number(e.target.value) })}
              className={inputClass}
            />
          </FormField>
        </div>

        {/* 설명 */}
        <FormField label="설명">
          <input
            value={editData.description}
            onChange={(e) => onChange({ ...editData, description: e.target.value })}
            className={inputClass}
            placeholder="한줄 설명"
          />
        </FormField>

        {/* 썸네일 URL */}
        <FormField label="썸네일 URL">
          <input
            value={editData.thumbnailUrl}
            onChange={(e) => onChange({ ...editData, thumbnailUrl: e.target.value })}
            className={inputClass}
            placeholder="https://..."
          />
        </FormField>

        {/* 추가 이미지 URLs */}
        <FormField label="추가 이미지 URLs">
          <div className="space-y-2">
            {editData.imageUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={url}
                  onChange={(e) => handleImageUrlChange(i, e.target.value)}
                  className={inputClass}
                  placeholder={`이미지 ${i + 1} URL`}
                />
                <button
                  type="button"
                  onClick={() => handleImageUrlRemove(i)}
                  className="shrink-0 p-1.5 rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleImageUrlAdd}
              className="flex items-center gap-1.5 text-[12px] text-[#000666] hover:underline mt-1"
            >
              <Plus size={12} /> 이미지 추가
            </button>
          </div>
        </FormField>

        {/* 체크박스 */}
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
            <input
              type="checkbox"
              checked={editData.isVisible}
              onChange={(e) => onChange({ ...editData, isVisible: e.target.checked })}
              className="accent-[#000666]"
            />
            노출
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
            <input
              type="checkbox"
              checked={editData.isPopular}
              onChange={(e) => onChange({ ...editData, isPopular: e.target.checked })}
              className="accent-[#000666]"
            />
            인기 차량
          </label>
        </div>
      </div>
    </div>
  );
}
