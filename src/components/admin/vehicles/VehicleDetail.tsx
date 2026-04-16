import Link from "next/link";
import { Tag, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKRWMan } from "@/lib/format";
import type { AdminVehicle } from "@/types/admin";

const BRAND_COLORS: Record<string, string> = {
  현대: "linear-gradient(145deg, #000666 0%, #1A1A6E 60%, #3333CC 100%)",
  기아: "linear-gradient(145deg, #111111 0%, #2A2A2A 100%)",
  제네시스: "linear-gradient(145deg, #1C1407 0%, #3D2E0F 100%)",
};

interface VehicleDetailProps {
  vehicle: AdminVehicle;
  onToggleVisibility: (v: AdminVehicle) => void;
}

export function VehicleDetail({ vehicle, onToggleVisibility }: VehicleDetailProps) {
  return (
    <div className="flex-1 bg-[#F8F9FC] flex flex-col relative overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* 썸네일 */}
        <div
          className="h-[280px] w-full relative flex items-end p-8 overflow-hidden"
          style={{ background: BRAND_COLORS[vehicle.brand] ?? BRAND_COLORS["현대"] }}
        >
          {vehicle.thumbnailUrl && (
            <img
              src={vehicle.thumbnailUrl}
              alt={vehicle.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="relative z-10 text-white w-full">
            <span className="inline-block px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-medium mb-3">
              {vehicle.brand}
            </span>
            <h1 className="text-[32px] font-bold leading-tight">{vehicle.name}</h1>
            <p className="text-white/80 text-[14px] mt-1 break-keep">
              {vehicle.description ?? "등록된 설명이 없습니다."}
            </p>
          </div>
        </div>

        {/* 기본 정보 */}
        <div className="p-8 max-w-[800px] mx-auto space-y-8">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
              <p className="text-[11px] text-[#6B7399] font-medium mb-1">카테고리</p>
              <p className="text-[15px] font-semibold text-[#1A1A2E]">{vehicle.category}</p>
            </div>
            <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
              <p className="text-[11px] text-[#6B7399] font-medium mb-1">트림 수</p>
              <p className="text-[15px] font-semibold text-[#1A1A2E]">{vehicle._count?.trims ?? 0}개</p>
            </div>
            <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
              <p className="text-[11px] text-[#6B7399] font-medium mb-1">노출 상태</p>
              <button
                onClick={() => onToggleVisibility(vehicle)}
                className={cn(
                  "text-[15px] font-semibold",
                  vehicle.isVisible ? "text-emerald-600" : "text-red-500"
                )}
              >
                {vehicle.isVisible ? "노출 중" : "비노출"}
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A2E] mb-3 flex items-center gap-2">
              <Tag size={16} className="text-[#000666]" /> 기본 정보
            </h3>
            <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden shadow-sm">
              {[
                { label: "기준 가격", value: formatKRWMan(vehicle.basePrice) },
                { label: "차량 가산율", value: `${vehicle.surchargeRate}%` },
                { label: "차량 코드", value: vehicle.vehicleCode ?? "미설정" },
                { label: "Slug", value: vehicle.slug },
              ].map((item) => (
                <div key={item.label} className="flex px-4 py-3 border-b border-[#F0F2F8] last:border-0">
                  <span className="w-1/3 text-[12px] font-medium text-[#6B7399]">{item.label}</span>
                  <span className="w-2/3 text-[13px] text-[#1A1A2E]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="bg-white border-t border-[#E8EAF0] p-4 flex justify-end px-8 shrink-0">
        <Link
          href={`/admin/vehicles/${vehicle.id}`}
          className="flex items-center gap-2 bg-[#000666] text-white px-6 py-3 rounded-[8px] font-medium text-[13px] hover:bg-[#1A1A6E] transition-colors shadow-md"
        >
          <Settings size={16} /> 상세 정보 변경 (트림·이미지 편집) <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
