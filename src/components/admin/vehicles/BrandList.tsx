"use client";

import { cn } from "@/lib/utils";
import type { AdminBrand } from "@/types/admin";

interface BrandListProps {
  brands: AdminBrand[];
  selected: string | null;
  onSelect: (name: string) => void;
}

export function BrandList({ brands, selected, onSelect }: BrandListProps) {
  return (
    <div className="w-[280px] border-r border-[#E8EAF0] flex flex-col shrink-0 bg-[#FAFBFF]">
      <div className="p-4 border-b border-[#E8EAF0] bg-white z-10">
        <h2 className="text-[14px] font-semibold text-[#1A1A2E]">차량 브랜드</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {brands.length === 0 ? (
          <p className="text-[12px] text-center text-[#9BA4C0] mt-10">등록된 브랜드가 없습니다</p>
        ) : (
          brands.map((b) => {
            const isSelected = selected === b.name;
            return (
              <div
                key={b.name}
                onClick={() => onSelect(b.name)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors border",
                  isSelected
                    ? "bg-white border-[#000666] shadow-sm"
                    : "border-transparent hover:bg-white hover:border-[#E8EAF0]"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-[#E8EAF0] rounded-full flex items-center justify-center text-[9px] font-bold text-[#6B7399] tracking-tighter shrink-0 border border-[#D0D5E8]">
                    {b.name.substring(0, 2)}
                  </div>
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      isSelected ? "text-[#000666]" : "text-[#4A5270]"
                    )}
                  >
                    {b.name}
                  </span>
                </div>
                <span className="text-[11px] text-[#9BA4C0] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px]">
                  {b.vehicleCount}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
