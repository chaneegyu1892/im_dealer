"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Save, Plus, X, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail } from "@/types/admin";
import type { VehicleCategory } from "@/types/vehicle";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

interface BasicInfoTabProps {
  vehicle: AdminVehicleDetail;
}

export function BasicInfoTab({ vehicle }: BasicInfoTabProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category,
    basePrice: vehicle.basePrice,
    description: vehicle.description ?? "",
    thumbnailUrl: vehicle.thumbnailUrl,
    imageUrls: vehicle.imageUrls,
    surchargeRate: vehicle.surchargeRate,
    isVisible: vehicle.isVisible,
    isPopular: vehicle.isPopular,
    displayOrder: vehicle.displayOrder,
    vehicleCode: vehicle.vehicleCode ?? "",
    slug: vehicle.slug,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      router.refresh();
      alert("기본 정보가 저장되었습니다.");
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const [uploading, setUploading] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "thumbnail" | number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const key = target === "thumbnail" ? "thumbnail" : `image-${target}`;
    setUploading(key);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "vehicles");

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.url) {
        if (target === "thumbnail") {
          setData((prev) => ({ ...prev, thumbnailUrl: result.url }));
        } else {
          const next = [...data.imageUrls];
          next[target] = result.url;
          setData((prev) => ({ ...prev, imageUrls: next }));
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(null);
    }
  };

  const updateImgUrl = (index: number, val: string) => {
    const next = [...data.imageUrls];
    next[index] = val;
    setData({ ...data, imageUrls: next });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 좌측: 편집 폼 */}
      <div className="space-y-6">
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-6 shadow-sm space-y-4">
          <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-2">차량 기본 정보</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField label="차량명" required>
              <input
                value={data.name}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="브랜드" required>
              <select
                value={data.brand}
                onChange={(e) => setData({ ...data, brand: e.target.value })}
                className={selectClass}
              >
                {["현대", "기아", "제네시스", "KGM", "쉐보레", "르노"].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="분류" required>
              <select
                value={data.category}
                onChange={(e) => setData({ ...data, category: e.target.value as VehicleCategory })}
                className={selectClass}
              >
                {["세단", "SUV", "밴", "트럭"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="기본 가격 (만원)" required>
              <input
                type="number"
                value={data.basePrice / 10000}
                onChange={(e) => setData({ ...data, basePrice: Number(e.target.value) * 10000 })}
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="한줄 홍보 문구">
            <input
              value={data.description}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              className={inputClass}
              placeholder="예: 압도적인 품격과 가치"
            />
          </FormField>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#000666] text-white px-6 py-2.5 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E] transition-colors shadow-sm disabled:opacity-50"
            >
              <Save size={16} /> {saving ? "저장 중..." : "기본 정보 저장"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-6 shadow-sm space-y-4">
          <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-2">기타 설정</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="차량 코드">
              <input
                value={data.vehicleCode}
                onChange={(e) => setData({ ...data, vehicleCode: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="가산율 (%)">
              <input
                type="number"
                step="0.01"
                value={data.surchargeRate}
                onChange={(e) => setData({ ...data, surchargeRate: Number(e.target.value) })}
                className={inputClass}
              />
            </FormField>
          </div>
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
              <input
                type="checkbox"
                checked={data.isVisible}
                onChange={(e) => setData({ ...data, isVisible: e.target.checked })}
                className="accent-[#000666]"
              />
              노출 여부
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
              <input
                type="checkbox"
                checked={data.isPopular}
                onChange={(e) => setData({ ...data, isPopular: e.target.checked })}
                className="accent-[#000666]"
              />
              인기 차량
            </label>
          </div>
        </div>
      </div>

      {/* 우측: 이미지 관리 */}
      <div className="space-y-6">
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-6 shadow-sm space-y-4">
          <h3 className="text-[15px] font-bold text-[#1A1A2E] mb-2">이미지 관리</h3>
          
          <FormField label="대표 이미지 (Thumbnail)">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  value={data.thumbnailUrl}
                  onChange={(e) => setData({ ...data, thumbnailUrl: e.target.value })}
                  className={inputClass}
                  placeholder="이미지 경로 또는 URL"
                />
                <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E8EAF0] rounded-[6px] text-[12px] font-medium text-[#4A5270] hover:bg-[#F8F9FC] cursor-pointer shrink-0 transition-colors">
                  {uploading === "thumbnail" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  업로드
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, "thumbnail")}
                    disabled={uploading !== null}
                  />
                </label>
              </div>
              <div className="aspect-[16/9] rounded-[8px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden flex items-center justify-center relative group">
                {data.thumbnailUrl ? (
                  <img src={data.thumbnailUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-[#B0B8D0] flex flex-col items-center gap-2">
                    <ImageIcon size={32} strokeWidth={1.5} />
                    <span className="text-[11px]">미리보기 없음</span>
                  </div>
                )}
                {uploading === "thumbnail" && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <Loader2 size={24} className="text-[#000666] animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </FormField>

          <FormField label="추가 이미지 목록">
            <div className="space-y-3">
              {data.imageUrls.map((url, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={url}
                      onChange={(e) => updateImgUrl(i, e.target.value)}
                      className={inputClass}
                      placeholder={`이미지 ${i + 1} 경로 또는 URL`}
                    />
                    <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E8EAF0] rounded-[6px] text-[12px] font-medium text-[#4A5270] hover:bg-[#F8F9FC] cursor-pointer shrink-0 transition-colors">
                      {uploading === `image-${i}` ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, i)}
                        disabled={uploading !== null}
                      />
                    </label>
                    <button
                      onClick={() => setData({ ...data, imageUrls: data.imageUrls.filter((_, idx) => idx !== i) })}
                      className="p-2 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px] shrink-0"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  {url && (
                    <div className="aspect-video w-32 rounded-[4px] border border-[#E8EAF0] overflow-hidden relative group">
                      <img src={url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                      {uploading === `image-${i}` && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                          <Loader2 size={16} className="text-[#000666] animate-spin" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setData({ ...data, imageUrls: [...data.imageUrls, ""] })}
                className="flex items-center gap-1.5 text-[12px] text-[#000666] hover:underline font-medium"
              >
                <Plus size={14} /> 이미지 추가
              </button>
            </div>
          </FormField>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-semibold text-[#4A5270] flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
