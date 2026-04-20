"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKRWMan } from "@/lib/format";
import type { AdminVehicleDetail, AdminTrim } from "@/types/admin";
import { motion, AnimatePresence } from "framer-motion";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

interface TrimTabProps {
  vehicle: AdminVehicleDetail;
}

export function TrimTab({ vehicle }: TrimTabProps) {
  const [selectedLineupId, setSelectedLineupId] = useState<string>(
    vehicle.lineups[0]?.id ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [trimModal, setTrimModal] = useState<{ isOpen: boolean; target: AdminTrim | null }>(
    { isOpen: false, target: null }
  );

  const filteredTrims = useMemo(() => {
    return vehicle.trims.filter((t) => t.lineupId === selectedLineupId);
  }, [vehicle.trims, selectedLineupId]);

  const selectedLineup = vehicle.lineups.find(l => l.id === selectedLineupId);

  const handleSaveTrim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      price: Number(fd.get("price")) * 10000,
      engineType: fd.get("engineType") as string,
      isDefault: fd.get("isDefault") === "on",
      lineupId: selectedLineupId,
      fuelEfficiency: fd.get("fuelEfficiency") ? Number(fd.get("fuelEfficiency")) : null,
    };

    try {
      const url = trimModal.target 
        ? `/api/admin/vehicles/${vehicle.id}/trims/${trimModal.target.id}`
        : `/api/admin/vehicles/${vehicle.id}/trims`;
      const method = trimModal.target ? "PATCH" : "POST";
      
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (resp.ok) {
        setTrimModal({ isOpen: false, target: null });
        window.location.reload(); // Refresh to get updated vehicle data
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 트림을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/vehicles/${vehicle.id}/trims/${id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* 라인업 선택 */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
        <span className="text-[13px] font-bold text-[#4A5270] shrink-0">라인업 선택:</span>
        <div className="flex flex-wrap gap-2">
          {vehicle.lineups.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelectedLineupId(l.id)}
              className={cn(
                "px-4 py-2 rounded-full text-[13px] font-medium transition-all flex items-center gap-2",
                selectedLineupId === l.id
                  ? "bg-[#000666] text-white shadow-md shadow-indigo-100"
                  : "bg-[#F8F9FC] text-[#6B7399] border border-[#E8EAF0] hover:bg-[#F0F2F8]"
              )}
            >
              {selectedLineupId === l.id && <Check size={14} />}
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {!selectedLineupId ? (
        <div className="p-12 text-center bg-white rounded-[12px] border border-dashed border-[#E8EAF0]">
          <p className="text-[#9BA4C0] text-[14px]">라인업을 먼저 등록해주세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-[15px] font-bold text-[#1A1A2E]">
              {selectedLineup?.name} {" > "} 트림 리스트 ({filteredTrims.length})
            </h3>
            <button
              onClick={() => setTrimModal({ isOpen: true, target: null })}
              className="flex items-center gap-1.5 bg-[#000666] text-white px-4 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E]"
            >
              <Plus size={16} /> 트림 추가
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTrims.map((trim) => (
              <div key={trim.id} className="bg-white border border-[#E8EAF0] rounded-[12px] p-5 shadow-sm hover:border-[#000666]/30 transition-colors group relative">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-[15px] font-bold text-[#1A1A2E]">{trim.name}</h4>
                    <p className="text-[12px] text-[#9BA4C0]">{trim.engineType}</p>
                  </div>
                  <div className="flex gap-1 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setTrimModal({ isOpen: true, target: trim })}
                      className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(trim.id)}
                      className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#F0F2F8] flex justify-between items-center">
                  <span className="text-[16px] font-extrabold text-[#000666]">
                    {formatKRWMan(trim.price)}
                  </span>
                  {trim.isDefault && (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-[4px] font-bold uppercase tracking-wider">
                      Default
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredTrims.length === 0 && (
            <div className="p-12 text-center bg-white rounded-[12px] border border-[#E8EAF0]">
              <p className="text-[#9BA4C0] text-[13px]">이 라인업에 등록된 트림이 없습니다.</p>
            </div>
          )}
        </div>
      )}

      {/* 트림 추가/수정 모달 */}
      <AnimatePresence>
        {trimModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setTrimModal({ isOpen: false, target: null })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[16px] w-full max-w-[480px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-[#F0F2F8] flex justify-between items-center bg-[#F8F9FC]">
                <h3 className="text-[16px] font-bold text-[#1A1A2E]">
                  {trimModal.target ? "트림 수정" : "트림 추가"}
                  <span className="ml-2 text-[12px] font-normal text-[#6B7399]">in {selectedLineup?.name}</span>
                </h3>
                <button onClick={() => setTrimModal({ isOpen: false, target: null })} className="text-[#9BA4C0] hover:text-[#1A1A2E]">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveTrim} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">트림명</label>
                  <input
                    name="name"
                    autoFocus
                    defaultValue={trimModal.target?.name}
                    placeholder="예: 프레스티지, 노블레스"
                    className={inputClass}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">가격 (만원)</label>
                    <input
                      name="price"
                      type="number"
                      defaultValue={trimModal.target ? trimModal.target.price / 10000 : ""}
                      placeholder="0"
                      className={inputClass}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">엔진 타입</label>
                    <select
                      name="engineType"
                      defaultValue={trimModal.target?.engineType ?? "가솔린"}
                      className={selectClass}
                    >
                      {["가솔린", "디젤", "하이브리드", "EV"].map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">연비 (km/L)</label>
                  <input
                    name="fuelEfficiency"
                    type="number"
                    step="0.1"
                    defaultValue={trimModal.target?.fuelEfficiency ?? ""}
                    placeholder="0.0"
                    className={inputClass}
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px] text-[#1A1A2E] cursor-pointer pt-2">
                  <input
                    name="isDefault"
                    type="checkbox"
                    defaultChecked={trimModal.target?.isDefault ?? false}
                    className="w-4 h-4 accent-[#000666]"
                  />
                  이 라인업의 기본 트림으로 설정
                </label>

                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setTrimModal({ isOpen: false, target: null })}
                    className="flex-1 py-3 bg-[#F4F5F8] text-[#4A5270] rounded-[8px] text-[14px] font-bold hover:bg-[#E8EAF0]"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-3 bg-[#000666] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#1A1A6E] shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    {saving ? "처리 중..." : trimModal.target ? "수정하기" : "추가하기"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
