"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Car } from "lucide-react";
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
        className="bg-white rounded-[16px] border border-[#E8EAF0] flex h-full overflow-hidden"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <BrandList
          brands={initialBrands}
          selected={selectedBrandName}
          onSelect={(name) => {
            setSelectedBrandName(name);
            setSelectedVehicle(null);
          }}
        />

        <VehicleList
          vehicles={filteredVehicles}
          selectedId={selectedVehicle?.id ?? null}
          selectedBrand={selectedBrandName}
          search={search}
          onSearchChange={setSearch}
          onSelect={setSelectedVehicle}
          onAdd={() => setVehicleModal({ isOpen: true, target: null })}
          onEdit={(v) => setVehicleModal({ isOpen: true, target: v })}
          onDelete={(v) => setDeleteModal({ id: v.id, name: v.name })}
        />

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
