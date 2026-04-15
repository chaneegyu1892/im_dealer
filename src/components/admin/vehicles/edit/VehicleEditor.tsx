"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import type { AdminVehicleDetail } from "@/types/admin";
import { VehicleInfoForm, type VehicleEditData } from "./VehicleInfoForm";
import { TrimManager } from "./TrimManager";

interface VehicleEditorProps {
  vehicle: AdminVehicleDetail;
}

export function VehicleEditor({ vehicle }: VehicleEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<VehicleEditData>({
    brand: vehicle.brand,
    name: vehicle.name,
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

  const handleSaveVehicle = async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      router.push(`/admin/vehicles?selected=${vehicle.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 min-h-screen">
      {/* 상단 네비게이션 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/vehicles"
            className="w-8 h-8 flex items-center justify-center rounded-[8px] bg-white border border-[#E8EAF0] hover:bg-[#F4F5F8] text-[#6B7399] transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <p className="text-[11px] text-[#9BA4C0] font-medium uppercase tracking-wide">
              차량 관리
            </p>
            <h1 className="text-[18px] font-bold text-[#1A1A2E]">
              {vehicle.brand} {vehicle.name}
            </h1>
          </div>
        </div>
        <button
          onClick={handleSaveVehicle}
          disabled={saving}
          className="flex items-center gap-2 bg-[#000666] text-white px-5 py-2.5 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E] disabled:opacity-50 transition-colors"
        >
          <Save size={14} /> {saving ? "저장 중..." : "기본정보 저장"}
        </button>
      </div>

      {/* 2-컬럼 레이아웃 */}
      <div className="grid grid-cols-2 gap-5">
        <VehicleInfoForm
          vehicle={vehicle}
          editData={editData}
          onChange={setEditData}
        />
        <TrimManager vehicle={vehicle} />
      </div>
    </div>
  );
}
