"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import type { AdminVehicleDetail, AdminVehicleColor, ColorKind } from "@/types/admin";
import { ColorManager } from "../ColorManager";

interface ColorTabProps {
  vehicle: AdminVehicleDetail;
}

const KIND_LABELS: Record<ColorKind, string> = {
  EXTERIOR: "외장 색상",
  INTERIOR: "내장 색상",
};

export function ColorTab({ vehicle }: ColorTabProps) {
  const router = useRouter();
  const [modal, setModal] = useState<{
    isOpen: boolean;
    target: AdminVehicleColor | null;
    defaultKind: ColorKind;
  }>({ isOpen: false, target: null, defaultKind: "EXTERIOR" });

  const colors = vehicle.colors ?? [];
  const exteriors = colors.filter((c) => c.kind === "EXTERIOR");
  const interiors = colors.filter((c) => c.kind === "INTERIOR");

  const handleDelete = async (colorId: string) => {
    if (!confirm("이 색상을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/vehicles/${vehicle.id}/colors/${colorId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "삭제 중 오류가 발생했습니다.");
    }
  };

  const renderSection = (kind: ColorKind, list: AdminVehicleColor[]) => (
    <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F2F8]">
        <div>
          <h3 className="text-[15px] font-bold text-[#1A1A2E]">{KIND_LABELS[kind]}</h3>
          <p className="text-[11px] text-[#9BA4C0] mt-0.5">{list.length}개 색상 등록됨</p>
        </div>
        <button
          onClick={() => setModal({ isOpen: true, target: null, defaultKind: kind })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#000666] text-white text-[12px] font-bold hover:opacity-90"
        >
          <Plus size={12} />
          추가
        </button>
      </div>
      {list.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-[#C0C5D8]">
          등록된 색상이 없습니다. 우측 상단의 추가 버튼을 눌러 등록해 주세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
          {list.map((c) => (
            <div
              key={c.id}
              className="border border-[#E8EAF0] rounded-[10px] p-3 hover:border-[#000666] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full border-2 border-white shadow-md shrink-0"
                  style={{ background: c.hexCode }}
                  title={c.hexCode}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-bold text-[#1A1A2E] truncate">{c.name}</p>
                    {c.isDefault && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 rounded-[4px]">
                        <Star size={8} />
                        기본
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-mono text-[#9BA4C0] mt-0.5">{c.hexCode}</p>
                  <p className="text-[11px] text-[#4A5270] mt-1 tabular-nums">
                    {c.priceDelta > 0
                      ? `+${c.priceDelta.toLocaleString()}원`
                      : "추가요금 없음"}
                  </p>
                </div>
              </div>
              {c.imageUrl && (
                <div className="mt-2 rounded-[6px] overflow-hidden bg-[#F8F9FC] h-20 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">
                <button
                  onClick={() =>
                    setModal({ isOpen: true, target: c, defaultKind: c.kind })
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[11px] font-medium hover:bg-[#E8EAF0]"
                >
                  <Pencil size={10} />
                  수정
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="px-2 py-1.5 rounded-[6px] bg-red-50 text-red-600 text-[11px] font-medium hover:bg-red-100"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="bg-[#F9FAFF] border border-[#E5E5FA] rounded-[10px] px-4 py-3">
        <p className="text-[12px] text-[#000666] font-medium">
          외장·내장 색상은 차량 단위로 관리됩니다. 기본 색상은 고객 견적 페이지 진입 시 자동 선택되며,
          추가요금이 있는 경우 차량 가격에 합산되어 견적이 산출됩니다.
        </p>
      </div>

      {renderSection("EXTERIOR", exteriors)}
      {renderSection("INTERIOR", interiors)}

      {modal.isOpen && (
        <ColorManager
          vehicleId={vehicle.id}
          target={modal.target}
          defaultKind={modal.defaultKind}
          onClose={() => setModal({ isOpen: false, target: null, defaultKind: "EXTERIOR" })}
        />
      )}
    </div>
  );
}
