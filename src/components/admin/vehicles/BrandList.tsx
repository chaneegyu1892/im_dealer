"use client";

import { cn } from "@/lib/utils";
import type { AdminBrand } from "@/types/admin";

interface BrandListProps {
  brands: AdminBrand[];
  selected: string | null;
  onSelect: (name: string) => void;
}

export function BrandList({ brands, selected, onSelect }: BrandListProps) {
  const getLogoPath = (brandName: string) => {
    const mapping: Record<string, string> = {
      "현대": "/images/logos/hyundai.svg",
      "기아": "/images/logos/kia.svg",
      "제네시스": "/images/logos/genesis.svg",
      "KGM": "/images/logos/kgm.svg",
      "쉐보레": "/images/logos/chevrolet.svg",
      "르노": "/images/logos/renault.svg",
      "BMW": "/images/logos/bmw.svg",
      "벤츠": "/images/logos/mercedes.svg",
      "테슬라": "/images/logos/tesla.svg",
    };
    return mapping[brandName] || null;
  };

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
            const logoPath = getLogoPath(b.name);

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
                  <div className="w-10 h-10 bg-white rounded-[8px] flex items-center justify-center p-1.5 shrink-0 border border-[#E8EAF0]">
                    {logoPath ? (
                      <img src={logoPath} alt={b.name} className="w-full h-full object-contain" />
                    ) : (
                      <div className="text-[9px] font-bold text-[#6B7399] tracking-tighter">
                        {b.name.substring(0, 2)}
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[13px] font-medium transition-colors",
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
