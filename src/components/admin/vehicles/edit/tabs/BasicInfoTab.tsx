"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import type { AdminVehicleDetail } from "@/types/admin";
import {
  BasicInfoCoreFields,
  type BasicInfoFormData,
} from "./BasicInfoCoreFields";
import { BasicInfoFlags } from "./BasicInfoFlags";
import { BasicInfoRepresentativePreview } from "./BasicInfoRepresentativePreview";

interface BasicInfoTabProps {
  readonly vehicle: AdminVehicleDetail;
  readonly onOpenImages: () => void;
}

function initialFormData(vehicle: AdminVehicleDetail): BasicInfoFormData {
  return {
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category,
    basePrice: vehicle.basePrice,
    description: vehicle.description ?? "",
    surchargeRate: vehicle.surchargeRate,
    isVisible: vehicle.isVisible,
    isPopular: vehicle.isPopular,
    isSpotlight: vehicle.isSpotlight,
    displayOrder: vehicle.displayOrder,
    vehicleCode: vehicle.vehicleCode ?? "",
    slug: vehicle.slug,
    slidingDoorOverride: vehicle.slidingDoorOverride,
    advancedSafetyOverride: vehicle.advancedSafetyOverride,
    tags: vehicle.tags,
  };
}

export function BasicInfoTab({ vehicle, onOpenImages }: BasicInfoTabProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BasicInfoFormData>(() =>
    initialFormData(vehicle)
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        alert("저장 중 오류가 발생했습니다.");
        return;
      }
      router.refresh();
      alert("기본 정보가 저장되었습니다.");
    } catch (error) {
      if (error instanceof Error) {
        console.error(error);
      }
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <section className="space-y-4 rounded-[12px] border border-[#E8EAF0] bg-white p-4 shadow-sm sm:p-6">
          <h3 className="text-[15px] font-bold text-[#1A1A2E]">차량 기본 정보</h3>
          <BasicInfoCoreFields data={data} setData={setData} />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex min-h-11 items-center gap-2 rounded-[8px] bg-[#000666] px-6 py-2.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#1A1A6E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6066EE] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} aria-hidden="true" />
              {saving ? "저장 중..." : "기본 정보 저장"}
            </button>
          </div>
        </section>
        <BasicInfoFlags data={data} setData={setData} />
      </div>

      <BasicInfoRepresentativePreview
        vehicleName={vehicle.name}
        thumbnailUrl={vehicle.thumbnailUrl}
        isLinked={vehicle.thumbnailImageId !== null}
        onOpenImages={onOpenImages}
      />
    </div>
  );
}
