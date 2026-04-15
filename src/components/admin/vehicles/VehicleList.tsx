"use client";

import { Search, Plus, Car, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKRWMan } from "@/lib/format";
import type { AdminVehicle } from "@/types/admin";

interface VehicleListProps {
  vehicles: AdminVehicle[];
  selectedId: string | null;
  selectedBrand: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (v: AdminVehicle) => void;
  onAdd: () => void;
  onEdit: (v: AdminVehicle) => void;
  onDelete: (v: AdminVehicle) => void;
}

export function VehicleList({
  vehicles,
  selectedId,
  selectedBrand,
  search,
  onSearchChange,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: VehicleListProps) {
  return (
    <div className="w-[360px] border-r border-[#E8EAF0] flex flex-col shrink-0 bg-white">
      <div className="p-4 border-b border-[#E8EAF0] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#1A1A2E] flex items-center gap-1.5">
            {selectedBrand ?? "브랜드 선택"}
            <span className="text-[12px] font-normal text-[#9BA4C0] px-1.5 py-0.5 bg-[#F4F5F8] rounded-[4px]">
              {vehicles.length}
            </span>
          </h2>
          <button
            disabled={!selectedBrand}
            onClick={onAdd}
            className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#F0F2F8] text-[#000666] disabled:opacity-30 transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0B8D0]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="차량명 검색"
            disabled={!selectedBrand}
            className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#C0C5DC] disabled:opacity-50 transition-colors placeholder:text-[#B0B8D0]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#F8F9FC]/50">
        {!selectedBrand ? (
          <div className="h-full flex flex-col items-center justify-center text-[#9BA4C0] space-y-2">
            <Car size={32} strokeWidth={1} />
            <p className="text-[12px]">왼쪽에서 브랜드를 선택해주세요</p>
          </div>
        ) : vehicles.length === 0 ? (
          <p className="text-[12px] text-center text-[#9BA4C0] mt-10">차량 데이터가 없습니다</p>
        ) : (
          vehicles.map((v) => {
            const isSelected = selectedId === v.id;
            return (
              <div
                key={v.id}
                onClick={() => onSelect(v)}
                className={cn(
                  "group flex flex-col p-3 rounded-[8px] cursor-pointer transition-all border",
                  isSelected
                    ? "bg-white border-[#000666] shadow-sm"
                    : "bg-white border-[#E8EAF0] hover:border-[#C0C5DC]"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] text-[#6B7399] border border-[#E8EAF0] px-1.5 py-0.5 rounded-[4px]">
                        {v.category}
                      </span>
                      {!v.isVisible && (
                        <span className="text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-[4px]">
                          비노출
                        </span>
                      )}
                    </div>
                    <h3 className="text-[14px] font-bold text-[#1A1A2E] truncate">{v.name}</h3>
                    <p className="text-[12px] font-medium text-[#4A5270] mt-1">
                      기준가{" "}
                      <span className="text-[#000666]">{formatKRWMan(v.basePrice)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(v); }}
                      className="p-1.5 rounded hover:bg-[#F0F2F8] text-[#9BA4C0] hover:text-[#000666]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(v); }}
                      className="p-1.5 rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
