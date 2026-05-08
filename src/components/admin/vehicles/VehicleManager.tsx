"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Car, ChevronLeft } from "lucide-react";
import type { AdminVehicle, AdminBrand } from "@/types/admin";
import type { VehicleCategory } from "@/types/vehicle";
import { BrandList } from "./BrandList";
import { VehicleList } from "./VehicleList";
import { VehicleDetail } from "./VehicleDetail";
import { VehicleFormModal, DeleteVehicleModal } from "./VehicleFormModal";

interface VehicleManagerProps {
  initialVehicles: AdminVehicle[];
  initialBrands: AdminBrand[];
  initialSelectedId?: string;
}

export function VehicleManager({ initialVehicles, initialBrands, initialSelectedId }: VehicleManagerProps) {
  const router = useRouter();

  const preSelected = initialSelectedId
    ? (initialVehicles.find((v) => v.id === initialSelectedId) ?? null)
    : null;

  const [selectedBrandName, setSelectedBrandName] = useState<string | null>(
    preSelected?.brand ?? initialBrands[0]?.name ?? null
  );
  const [selectedVehicle, setSelectedVehicle] = useState<AdminVehicle | null>(preSelected);
  const [mobilePanel, setMobilePanel] = useState<"brands" | "list" | "detail">(
    preSelected ? "detail" : "brands"
  );

  // router.push로 돌아올 때 컴포넌트가 재사용되면 useState 초기값이 재적용되지 않으므로
  // initialSelectedId 변화를 감지해서 선택 상태를 동기화
  useEffect(() => {
    if (!initialSelectedId) return;
    const vehicle = initialVehicles.find((v) => v.id === initialSelectedId);
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setSelectedBrandName(vehicle.brand);
    }
  }, [initialSelectedId, initialVehicles]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [vehicleModal, setVehicleModal] = useState<{ isOpen: boolean; target: AdminVehicle | null }>(
    { isOpen: false, target: null }
  );
  const [deleteModal, setDeleteModal] = useState<{ id: string; name: string } | null>(null);

  const filteredVehicles = useMemo(() => {
    if (!selectedBrandName) return [];
    const byBrand = initialVehicles.filter((v) => v.brand === selectedBrandName);
    if (!search) return byBrand;
    return byBrand.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()));
  }, [initialVehicles, selectedBrandName, search]);

  const handleSaveVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      brand: selectedBrandName,
      category: fd.get("category") as VehicleCategory,
      basePrice: Number(fd.get("basePrice")) * 10000,
    };
    try {
      if (vehicleModal.target) {
        await fetch(`/api/admin/vehicles/${vehicleModal.target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/admin/vehicles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setVehicleModal({ isOpen: false, target: null });
      setSelectedVehicle(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/vehicles/${deleteModal.id}`, { method: "DELETE" });
      if (selectedVehicle?.id === deleteModal.id) setSelectedVehicle(null);
      setDeleteModal(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (vehicle: AdminVehicle) => {
    const toggled = { ...vehicle, isVisible: !vehicle.isVisible };
    setSelectedVehicle(toggled);
    await fetch(`/api/admin/vehicles/${vehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: toggled.isVisible }),
    });
    router.refresh();
  };

  return (
    <div className="h-full">
      <div
        className="bg-white rounded-[16px] border border-[#E8EAF0] flex flex-col h-full overflow-hidden"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        {/* 모바일 전용 내비게이션 바 */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-[#E8EAF0] bg-white shrink-0">
          {mobilePanel !== "brands" ? (
            <button
              onClick={() => {
                if (mobilePanel === "detail") { setSelectedVehicle(null); setMobilePanel("list"); }
                else { setSelectedBrandName(null); setMobilePanel("brands"); }
              }}
              className="flex items-center gap-1 text-[13px] font-medium text-[#6B7399] active:text-[#1A1A2E] transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
              {mobilePanel === "detail" ? "목록" : "브랜드"}
            </button>
          ) : (
            <span className="text-[13px] font-bold text-[#1A1A2E]">차량 관리</span>
          )}
          {mobilePanel !== "brands" && (
            <span className="text-[13px] font-semibold text-[#1A1A2E] truncate min-w-0">
              {mobilePanel === "detail" ? (selectedVehicle?.name ?? "") : (selectedBrandName ?? "")}
            </span>
          )}
          {/* 단계 표시 */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {(["brands", "list", "detail"] as const).map((step, i) => (
              <div
                key={step}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  mobilePanel === step ? "bg-[#000666]" : "bg-[#D0D5E8]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 메인 패널 영역 */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* BrandList: 데스크탑 항상 표시 / 모바일 brands 단계에서만 */}
          <div className={`shrink-0 flex flex-col ${mobilePanel !== "brands" ? "max-md:hidden" : "w-full md:w-auto"}`}>
            <BrandList
              brands={initialBrands}
              selected={selectedBrandName}
              onSelect={(name) => {
                setSelectedBrandName(name);
                setSelectedVehicle(null);
                setMobilePanel("list");
              }}
            />
          </div>

          {/* VehicleList: 데스크탑 항상 표시 / 모바일 list 단계에서만 */}
          <div className={`shrink-0 flex flex-col ${mobilePanel !== "list" ? "max-md:hidden" : "w-full md:w-auto"}`}>
            <VehicleList
              vehicles={filteredVehicles}
              selectedId={selectedVehicle?.id ?? null}
              selectedBrand={selectedBrandName}
              search={search}
              onSearchChange={setSearch}
              onSelect={(v) => { setSelectedVehicle(v); setMobilePanel("detail"); }}
              onAdd={() => setVehicleModal({ isOpen: true, target: null })}
              onEdit={(v) => setVehicleModal({ isOpen: true, target: v })}
              onDelete={(v) => setDeleteModal({ id: v.id, name: v.name })}
            />
          </div>

          {/* Detail: 데스크탑 항상 표시 / 모바일 detail 단계에서만 */}
          <div className={`flex-1 overflow-hidden flex flex-col ${mobilePanel !== "detail" ? "max-md:hidden" : ""}`}>
            {selectedVehicle ? (
              <VehicleDetail
                vehicle={selectedVehicle}
                onToggleVisibility={handleToggleVisibility}
              />
            ) : (
              <div className="flex-1 bg-[#F8F9FC] flex flex-col items-center justify-center text-[#9BA4C0] gap-3">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Car size={32} className="text-[#D0D5E8]" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-medium text-[#6B7399]">
                  차량을 선택하면 상세 정보가 표시됩니다
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {vehicleModal.isOpen && (
        <VehicleFormModal
          target={vehicleModal.target}
          selectedBrand={selectedBrandName}
          saving={saving}
          onSubmit={handleSaveVehicle}
          onClose={() => setVehicleModal({ isOpen: false, target: null })}
        />
      )}

      {deleteModal && (
        <DeleteVehicleModal
          name={deleteModal.name}
          saving={saving}
          onConfirm={handleDelete}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
