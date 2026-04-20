"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail, AdminTrimOption } from "@/types/admin";
import { motion, AnimatePresence } from "framer-motion";
import { OptionManager } from "../OptionManager";

interface OptionTabProps {
  vehicle: AdminVehicleDetail;
}

export function OptionTab({ vehicle }: OptionTabProps) {
  const [selectedLineupId, setSelectedLineupId] = useState<string>(
    vehicle.lineups[0]?.id ?? ""
  );
  
  const trimsOfLineup = useMemo(() => {
    return vehicle.trims.filter(t => t.lineupId === selectedLineupId);
  }, [vehicle.trims, selectedLineupId]);

  const [selectedTrimId, setSelectedTrimId] = useState<string>(
    trimsOfLineup[0]?.id ?? ""
  );

  // Lineup 변경 시 Trim 자동 선택
  useMemo(() => {
    if (selectedLineupId && !trimsOfLineup.find(t => t.id === selectedTrimId)) {
      setSelectedTrimId(trimsOfLineup[0]?.id ?? "");
    }
  }, [selectedLineupId, trimsOfLineup]);

  const selectedTrim = vehicle.trims.find(t => t.id === selectedTrimId);
  const options = selectedTrim?.options ?? [];

  const [optionModal, setOptionModal] = useState<{
    isOpen: boolean;
    trimId: string;
    target: AdminTrimOption | null;
  }>({ isOpen: false, trimId: "", target: null });

  const handleDelete = async (optId: string) => {
    if (!confirm("이 옵션을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/trims/${selectedTrimId}/options/${optId}`, { method: "DELETE" });
    window.location.reload();
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
          <div className="flex justify-between items-center bg-[#F8F9FC] p-4 rounded-[12px] border border-[#E8EAF0]">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A2E]">
              <span className="text-[#000666]">{vehicle.lineups.find(l => l.id === selectedLineupId)?.name}</span>
              <ChevronRight size={14} className="text-[#9BA4C0]" />
              <span className="text-[#000666]">{selectedTrim?.name}</span>
              <span className="ml-2 px-2 py-0.5 bg-white text-[11px] rounded-[4px] border border-[#E8EAF0]">옵션 총 {options.length}개</span>
            </div>
            <button
              onClick={() => setOptionModal({ isOpen: true, trimId: selectedTrimId, target: null })}
              className="flex items-center gap-1.5 bg-[#000666] text-white px-4 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E]"
            >
              <Plus size={16} /> 옵션 추가
            </button>
          </div>

          <div className="bg-white border border-[#E8EAF0] rounded-[12px] overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8F9FC] text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">유형</th>
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">옵션명</th>
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">추가 가격</th>
                  <th className="px-5 py-3 border-b border-[#E8EAF0]">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F2F8]">
                {options.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-[#9BA4C0] text-[13px]">
                      등록된 옵션이 없습니다.
                    </td>
                  </tr>
                ) : (
                  options.map((opt) => (
                    <tr key={opt.id} className="hover:bg-[#F8F9FC]/50 transition-colors group">
                      <td className="px-5 py-4 w-[120px]">
                        {opt.isAccessory ? (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100">ACC</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold border border-indigo-100">OPT</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-semibold text-[#1A1A2E]">{opt.name}</span>
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
                            onClick={() => setOptionModal({ isOpen: true, trimId: selectedTrimId, target: opt })}
                            className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-white rounded-[6px] border border-transparent hover:border-[#E8EAF0]"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(opt.id)}
                            className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px] border border-transparent hover:border-red-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
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
          onClose={() => setOptionModal({ isOpen: false, trimId: "", target: null })}
        />
      )}
    </div>
  );
}
