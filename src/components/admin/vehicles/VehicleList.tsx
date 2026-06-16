"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Reorder, useDragControls } from "framer-motion";
import { Search, Plus, Car, Pencil, Trash2, GripVertical } from "lucide-react";
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
  /** 드래그로 재정렬된 차량 id 순서를 저장 */
  onReorder: (orderedIds: string[]) => void;
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
  onReorder,
}: VehicleListProps) {
  // 드래그 중 시각 상태를 위한 로컬 사본. 외부에서 목록(브랜드 전환·추가·삭제·저장 후
  // refresh)이 바뀌면 시그니처가 달라질 때만 재동기화하여 드래그 중 깜빡임을 막는다.
  const [items, setItems] = useState<AdminVehicle[]>(vehicles);
  const sig = vehicles.map((v) => v.id).join(",");
  const lastSig = useRef(sig);
  useEffect(() => {
    if (sig !== lastSig.current) {
      setItems(vehicles);
      lastSig.current = sig;
    }
  }, [sig, vehicles]);

  // 검색 중에는 부분 목록만 보이므로 재정렬 비활성화(전체 순서를 보장할 수 없음).
  const reorderable = !search && vehicles.length > 1;

  const commitOrder = () => {
    const next = items.map((v) => v.id);
    if (next.join(",") !== vehicles.map((v) => v.id).join(",")) {
      onReorder(next);
    }
  };

  return (
    <div className="w-full md:w-[360px] h-full border-r border-[#E8EAF0] flex flex-col shrink-0 min-h-0 bg-white">
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
        {reorderable && (
          <p className="text-[11px] text-[#9BA4C0] flex items-center gap-1">
            <GripVertical size={11} />
            손잡이를 끌어 노출 순서를 바꾸세요
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 bg-[#F8F9FC]/50">
        {!selectedBrand ? (
          <div className="h-full flex flex-col items-center justify-center text-[#9BA4C0] space-y-2">
            <Car size={32} strokeWidth={1} />
            <p className="text-[12px]">왼쪽에서 브랜드를 선택해주세요</p>
          </div>
        ) : vehicles.length === 0 ? (
          <p className="text-[12px] text-center text-[#9BA4C0] mt-10">차량 데이터가 없습니다</p>
        ) : reorderable ? (
          <Reorder.Group axis="y" values={items} onReorder={setItems} className="space-y-1">
            {items.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                draggable
                isSelected={selectedId === v.id}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onCommit={commitOrder}
              />
            ))}
          </Reorder.Group>
        ) : (
          <div className="space-y-1">
            {(search
              ? vehicles
              : items
            ).map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                draggable={false}
                isSelected={selectedId === v.id}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface VehicleRowProps {
  vehicle: AdminVehicle;
  draggable: boolean;
  isSelected: boolean;
  onSelect: (v: AdminVehicle) => void;
  onEdit: (v: AdminVehicle) => void;
  onDelete: (v: AdminVehicle) => void;
  onCommit?: () => void;
}

function VehicleRow({
  vehicle: v,
  draggable,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onCommit,
}: VehicleRowProps) {
  const controls = useDragControls();

  const card = (
    <div
      onClick={() => onSelect(v)}
      className={cn(
        "group flex gap-2 p-3 rounded-[8px] cursor-pointer transition-all border",
        isSelected
          ? "bg-white border-[#000666] shadow-sm"
          : "bg-white border-[#E8EAF0] hover:border-[#C0C5DC]"
      )}
    >
      {draggable && (
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            controls.start(e);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label="순서 변경 손잡이"
          className="shrink-0 -ml-1 flex items-center text-[#C0C5DC] hover:text-[#6B7399] cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical size={16} />
        </button>
      )}
      <div className="w-16 h-12 bg-[#F8F9FC] rounded-[6px] border border-[#F0F2F8] overflow-hidden shrink-0 flex items-center justify-center">
        {v.thumbnailUrl ? (
          <Image
            src={v.thumbnailUrl}
            alt={v.name}
            width={64}
            height={48}
            unoptimized={v.thumbnailUrl.startsWith("http")}
            className="w-full h-full object-cover"
          />
        ) : (
          <Car size={16} className="text-[#D0D5E8]" strokeWidth={1.5} />
        )}
      </div>
      <div className="flex-1 min-w-0 flex justify-between items-start">
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
            기준가 <span className="text-[#000666]">{formatKRWMan(v.basePrice)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 max-md:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(v); }}
            className="p-1.5 rounded hover:bg-[#F0F2F8] text-[#9BA4C0] hover:text-[#000666] active:bg-[#F0F2F8]"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(v); }}
            className="p-1.5 rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500 active:bg-red-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  if (!draggable) return card;

  return (
    <Reorder.Item
      value={v}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
    >
      {card}
    </Reorder.Item>
  );
}
