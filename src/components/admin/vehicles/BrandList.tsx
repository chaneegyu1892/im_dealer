"use client";

import Image from "next/image";
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
      "현대": "/images/vehicles/logos/hyundai.svg",
      "기아": "/images/vehicles/logos/kia.svg",
      "제네시스": "/images/vehicles/logos/genesis.svg",
      "KGM": "/images/vehicles/logos/kgm.svg",
      "쉐보레": "/images/vehicles/logos/chevrolet.svg",
      "르노": "/images/vehicles/logos/renault.svg",
      "BMW": "/images/vehicles/logos/bmw.svg",
      "벤츠": "/images/vehicles/logos/mercedes.svg",
      "테슬라": "/images/vehicles/logos/tesla.svg",
    };
    return mapping[brandName] || null;
  };

  return (
    <div className="w-full md:w-[280px] border-r border-[#E8EAF0] flex flex-col shrink-0 bg-[#FAFBFF]">
      <div className="px-4 py-3 border-b border-[#E8EAF0] bg-white z-10">
        <h2 className="text-[14px] font-semibold text-[#1A1A2E]">차량 브랜드</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {brands.length === 0 ? (
          <p className="text-[12px] text-center text-[#9BA4C0] mt-10">등록된 브랜드가 없습니다</p>
        ) : (
          <>
            {/* 모바일: 2열 그리드 */}
            <div className="grid grid-cols-2 gap-2 md:hidden">
              {brands.map((b) => {
                const isSelected = selected === b.name;
                const logoPath = getLogoPath(b.name);
                return (
                  <div
                    key={b.name}
                    onClick={() => onSelect(b.name)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-[10px] cursor-pointer transition-all border",
                      isSelected
                        ? "bg-white border-[#000666] shadow-sm"
                        : "bg-white border-[#E8EAF0] hover:border-[#C0C5DC]"
                    )}
                  >
                    <div className="w-12 h-12 bg-[#F8F9FC] rounded-[10px] flex items-center justify-center p-2 border border-[#E8EAF0]">
                      {logoPath ? (
                        <Image src={logoPath} alt={b.name} width={48} height={48} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-[11px] font-bold text-[#6B7399]">{b.name.substring(0, 2)}</span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className={cn("text-[13px] font-semibold", isSelected ? "text-[#000666]" : "text-[#1A1A2E]")}>
                        {b.name}
                      </p>
                      <p className="text-[11px] text-[#9BA4C0]">{b.vehicleCount}대</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 데스크탑: 리스트 */}
            <div className="hidden md:flex flex-col gap-1">
              {brands.map((b) => {
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
                          <Image src={logoPath} alt={b.name} width={40} height={40} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[9px] font-bold text-[#6B7399] tracking-tighter">{b.name.substring(0, 2)}</span>
                        )}
                      </div>
                      <span className={cn("text-[13px] font-medium", isSelected ? "text-[#000666]" : "text-[#4A5270]")}>
                        {b.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#9BA4C0] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px]">
                      {b.vehicleCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
