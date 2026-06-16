"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import { Plus, Pencil, Trash2, Check, ChevronRight, GripVertical, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail, AdminTrimOption, AdminOptionBadge } from "@/types/admin";
import { OptionManager } from "../OptionManager";
import { OptionBadgeManager } from "../OptionBadgeManager";

interface OptionTabProps {
  vehicle: AdminVehicleDetail;
}

export function OptionTab({ vehicle }: OptionTabProps) {
  const router = useRouter();

  const [selectedLineupId, setSelectedLineupId] = useState<string>(
    vehicle.lineups[0]?.id ?? ""
  );

  const trimsOfLineup = useMemo(() => {
    return vehicle.trims.filter((t) => t.lineupId === selectedLineupId);
  }, [vehicle.trims, selectedLineupId]);

  const [selectedTrimIdState, setSelectedTrimId] = useState<string>(
    trimsOfLineup[0]?.id ?? ""
  );

  const selectedTrimId = trimsOfLineup.some((t) => t.id === selectedTrimIdState)
    ? selectedTrimIdState
    : trimsOfLineup[0]?.id ?? "";

  const selectedTrim = vehicle.trims.find((t) => t.id === selectedTrimId);
  const baseOptions = useMemo(() => selectedTrim?.options ?? [], [selectedTrim]);

  // 드래그 재정렬용 로컬 사본 — 선택 트림/데이터가 바뀌면 재동기화
  const [items, setItems] = useState<AdminTrimOption[]>(baseOptions);
  const sig = baseOptions.map((o) => o.id).join(",");
  const lastSig = useRef(sig);
  useEffect(() => {
    if (sig !== lastSig.current) {
      setItems(baseOptions);
      lastSig.current = sig;
    }
  }, [sig, baseOptions]);

  // 추천 배지 목록 (전역, 클라이언트 조회)
  const [badges, setBadges] = useState<AdminOptionBadge[]>([]);
  const loadBadges = useCallback(async () => {
    const resp = await fetch("/api/admin/option-badges");
    const json = await resp.json();
    if (json.success) setBadges(json.data);
  }, []);
  useEffect(() => {
    loadBadges();
  }, [loadBadges]);

  const [optionModal, setOptionModal] = useState<{
    isOpen: boolean;
    trimId: string;
    target: AdminTrimOption | null;
  }>({ isOpen: false, trimId: "", target: null });
  const [badgeManagerOpen, setBadgeManagerOpen] = useState(false);

  const handleDelete = async (optId: string) => {
    if (!confirm("이 옵션을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/trims/${selectedTrimId}/options/${optId}`, { method: "DELETE" });
    router.refresh();
  };

  const reorderable = items.length > 1;

  const commitOrder = async () => {
    const next = items.map((o) => o.id);
    if (next.join(",") === baseOptions.map((o) => o.id).join(",")) return;
    await fetch(`/api/admin/trims/${selectedTrimId}/options/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 계층형 선택기 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 라인업 선택 */}
        <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm space-y-3">
          <h4 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider">1. 라인업 선택</h4>
          <div className="flex flex-wrap gap-2">
            {vehicle.lineups.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLineupId(l.id)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all",
                  selectedLineupId === l.id
                    ? "bg-[#000666] text-white"
                    : "bg-[#F8F9FC] text-[#6B7399] border border-[#E8EAF0] hover:bg-[#F0F2F8]"
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>

        {/* 트림 선택 */}
        <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm space-y-3">
          <h4 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider">2. 트림 선택</h4>
          <div className="flex flex-wrap gap-2">
            {trimsOfLineup.length === 0 ? (
              <p className="text-[12px] text-[#9BA4C0] py-1.5 italic">이 라인업에 등록된 트림이 없습니다.</p>
            ) : (
              trimsOfLineup.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTrimId(t.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all flex items-center gap-1.5",
                    selectedTrimId === t.id
                      ? "bg-[#000666] text-white"
                      : "bg-[#F8F9FC] text-[#6B7399] border border-[#E8EAF0] hover:bg-[#F0F2F8]"
                  )}
                >
                  {selectedTrimId === t.id && <Check size={14} />}
                  {t.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedTrimId ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-between items-center bg-[#F8F9FC] p-4 rounded-[12px] border border-[#E8EAF0]">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A2E]">
              <span className="text-[#000666]">{vehicle.lineups.find((l) => l.id === selectedLineupId)?.name}</span>
              <ChevronRight size={14} className="text-[#9BA4C0]" />
              <span className="text-[#000666]">{selectedTrim?.name}</span>
              <span className="ml-2 px-2 py-0.5 bg-white text-[11px] rounded-[4px] border border-[#E8EAF0]">옵션 총 {items.length}개</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBadgeManagerOpen(true)}
                className="flex items-center gap-1.5 bg-white text-[#000666] border border-[#000666]/30 px-3 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#F0F2F8]"
              >
                <Tag size={15} /> 배지 관리
              </button>
              <button
                onClick={() => setOptionModal({ isOpen: true, trimId: selectedTrimId, target: null })}
                className="flex items-center gap-1.5 bg-[#000666] text-white px-4 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E]"
              >
                <Plus size={16} /> 옵션 추가
              </button>
            </div>
          </div>

          {reorderable && (
            <p className="text-[12px] text-[#9BA4C0] flex items-center gap-1 px-1">
              <GripVertical size={12} />
              손잡이를 끌어 고객 화면 노출 순서를 바꾸세요. 추천 배지가 달린 옵션을 상단에 두면 더 잘 보입니다.
            </p>
          )}

          <div className="bg-white border border-[#E8EAF0] rounded-[12px] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FC] text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">
                  <th className="px-2 py-3 border-b border-[#E8EAF0] w-[36px]"></th>
                  <th className="px-3 py-3 border-b border-[#E8EAF0]">유형</th>
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">옵션명</th>
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">추가 가격</th>
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">관리</th>
                </tr>
              </thead>
              {items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#9BA4C0] text-[13px]">
                      등록된 옵션이 없습니다.
                    </td>
                  </tr>
                </tbody>
              ) : reorderable ? (
                <Reorder.Group as="tbody" axis="y" values={items} onReorder={setItems} className="divide-y divide-[#F0F2F8]">
                  {items.map((opt) => (
                    <OptionRow
                      key={opt.id}
                      opt={opt}
                      draggable
                      onEdit={() => setOptionModal({ isOpen: true, trimId: selectedTrimId, target: opt })}
                      onDelete={() => handleDelete(opt.id)}
                      onCommit={commitOrder}
                    />
                  ))}
                </Reorder.Group>
              ) : (
                <tbody className="divide-y divide-[#F0F2F8]">
                  {items.map((opt) => (
                    <OptionRow
                      key={opt.id}
                      opt={opt}
                      draggable={false}
                      onEdit={() => setOptionModal({ isOpen: true, trimId: selectedTrimId, target: opt })}
                      onDelete={() => handleDelete(opt.id)}
                    />
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-[12px] border border-dashed border-[#E8EAF0]">
          <p className="text-[#9BA4C0] text-[14px]">트림을 먼저 등록하거나 선택해주세요.</p>
        </div>
      )}

      {optionModal.isOpen && (
        <OptionManager
          trimId={optionModal.trimId}
          target={optionModal.target}
          badges={badges}
          nextDisplayOrder={items.length}
          onClose={() => setOptionModal({ isOpen: false, trimId: "", target: null })}
        />
      )}

      {badgeManagerOpen && (
        <OptionBadgeManager
          badges={badges}
          onChange={loadBadges}
          onClose={() => setBadgeManagerOpen(false)}
        />
      )}
    </div>
  );
}

interface OptionRowProps {
  opt: AdminTrimOption;
  draggable: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCommit?: () => void;
}

function OptionRow({ opt, draggable, onEdit, onDelete, onCommit }: OptionRowProps) {
  const controls = useDragControls();

  const cells = (
    <>
      <td className="px-2 py-4 w-[36px]">
        {draggable ? (
          <button
            onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
            aria-label="순서 변경 손잡이"
            className="flex items-center justify-center text-[#C0C5DC] hover:text-[#6B7399] cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={16} />
          </button>
        ) : null}
      </td>
      <td className="px-3 py-4 w-[110px]">
        {opt.isAccessory ? (
          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100">ACC</span>
        ) : (
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100">OPT</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[14px] font-semibold text-[#1A1A2E]">{opt.name}</span>
            {opt.badge && (
              <span className="inline-flex items-center text-[10px] font-bold text-[#000666] bg-[#E5E5FA] px-1.5 py-0.5 rounded-[4px]">
                {opt.badge.label}
              </span>
            )}
          </div>
          {opt.category && <span className="text-[11px] text-[#9BA4C0]">{opt.category}</span>}
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-[14px] font-medium text-[#4A5270]">+{opt.price.toLocaleString()}원</span>
        {opt.isDefault && <span className="ml-2 text-[10px] text-emerald-600 font-bold">(기본)</span>}
      </td>
      <td className="px-5 py-4 w-[100px]">
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-white rounded-[6px] border border-transparent hover:border-[#E8EAF0]"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px] border border-transparent hover:border-red-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </>
  );

  if (!draggable) {
    return <tr className="hover:bg-[#F8F9FC]/50 transition-colors group">{cells}</tr>;
  }

  return (
    <Reorder.Item
      as="tr"
      value={opt}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      className="hover:bg-[#F8F9FC]/50 transition-colors group bg-white"
    >
      {cells}
    </Reorder.Item>
  );
}
