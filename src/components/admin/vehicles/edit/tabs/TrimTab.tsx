"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X, Tag, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKRWMan } from "@/lib/format";
import type { AdminVehicleDetail, AdminTrim } from "@/types/admin";
import { motion, AnimatePresence } from "framer-motion";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

function calcDiscountRate(price: number, discountPrice: number): number {
  if (!price || !discountPrice || discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
}

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

  // 다중 선택 모드
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedTrimIds, setSelectedTrimIds] = useState<Set<string>>(new Set());
  const [bulkDiscountInput, setBulkDiscountInput] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // 개별 트림 모달 할인가 입력
  const [modalDiscountInput, setModalDiscountInput] = useState("");
  const [modalPriceInput, setModalPriceInput] = useState("");

  const filteredTrims = useMemo(() => {
    return vehicle.trims.filter((t) => t.lineupId === selectedLineupId);
  }, [vehicle.trims, selectedLineupId]);

  const selectedLineup = vehicle.lineups.find(l => l.id === selectedLineupId);

  const openModal = (trim: AdminTrim | null) => {
    setTrimModal({ isOpen: true, target: trim });
    setModalDiscountInput(
      trim?.discountPrice ? String(trim.discountPrice / 10000) : ""
    );
    setModalPriceInput(
      trim?.price ? String(trim.price / 10000) : ""
    );
  };

  const closeModal = () => {
    setTrimModal({ isOpen: false, target: null });
    setModalDiscountInput("");
    setModalPriceInput("");
  };

  const handleSaveTrim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const rawDiscount = Number(modalDiscountInput);
    const discountPrice = rawDiscount > 0 ? rawDiscount * 10000 : null;

    const payload = {
      name: fd.get("name") as string,
      price: Number(modalPriceInput) * 10000,
      discountPrice,
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
        closeModal();
        window.location.reload();
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

  const toggleTrimSelect = (id: string) => {
    setSelectedTrimIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllTrims = () => {
    if (selectedTrimIds.size === filteredTrims.length) {
      setSelectedTrimIds(new Set());
    } else {
      setSelectedTrimIds(new Set(filteredTrims.map(t => t.id)));
    }
  };

  const exitMultiSelectMode = () => {
    setMultiSelectMode(false);
    setSelectedTrimIds(new Set());
    setBulkDiscountInput("");
  };

  const handleBulkDiscount = async () => {
    if (bulkSaving || selectedTrimIds.size === 0) return;
    setBulkSaving(true);

    const rawDiscount = Number(bulkDiscountInput);
    const discountPrice = rawDiscount > 0 ? rawDiscount * 10000 : null;

    try {
      const resp = await fetch(
        `/api/admin/vehicles/${vehicle.id}/trims/bulk-discount`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trimIds: Array.from(selectedTrimIds), discountPrice }),
        }
      );
      if (resp.ok) {
        exitMultiSelectMode();
        window.location.reload();
      }
    } finally {
      setBulkSaving(false);
    }
  };

  // 모달에서 가격 / 할인가 입력 중 실시간 % 계산
  const modalPrice = Number(modalPriceInput) * 10000;
  const modalDiscount = Number(modalDiscountInput) * 10000;
  const modalDiscountRate = calcDiscountRate(modalPrice, modalDiscount);

  // 일괄 할인 패널에서 기준 가격은 선택된 트림들의 평균
  const selectedTrims = filteredTrims.filter(t => selectedTrimIds.has(t.id));
  const avgPrice = selectedTrims.length
    ? selectedTrims.reduce((s, t) => s + t.price, 0) / selectedTrims.length
    : 0;
  const bulkDiscount = Number(bulkDiscountInput) * 10000;
  const bulkDiscountRate = calcDiscountRate(avgPrice, bulkDiscount);

  return (
    <div className="space-y-6">
      {/* 라인업 선택 */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm">
        <span className="text-[13px] font-bold text-[#4A5270] shrink-0">라인업 선택:</span>
        <div className="flex flex-wrap gap-2">
          {vehicle.lineups.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setSelectedLineupId(l.id);
                exitMultiSelectMode();
              }}
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
            <div className="flex items-center gap-2">
              {filteredTrims.length > 0 && (
                <button
                  onClick={() => {
                    if (multiSelectMode) {
                      exitMultiSelectMode();
                    } else {
                      setMultiSelectMode(true);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[13px] font-medium border transition-colors",
                    multiSelectMode
                      ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                      : "bg-white border-[#E8EAF0] text-[#6B7399] hover:bg-[#F0F2F8]"
                  )}
                >
                  <Tag size={14} />
                  {multiSelectMode ? "선택 취소" : "일괄 할인"}
                </button>
              )}
              <button
                onClick={() => openModal(null)}
                className="flex items-center gap-1.5 bg-[#000666] text-white px-4 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E]"
              >
                <Plus size={16} /> 트림 추가
              </button>
            </div>
          </div>

          {/* 일괄 할인 패널 */}
          <AnimatePresence>
            {multiSelectMode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleAllTrims}
                        className="flex items-center gap-1.5 text-[13px] text-amber-700 font-medium hover:text-amber-900"
                      >
                        {selectedTrimIds.size === filteredTrims.length && filteredTrims.length > 0
                          ? <CheckSquare size={16} />
                          : <Square size={16} />
                        }
                        전체 선택
                      </button>
                      <span className="text-[12px] text-amber-600">
                        {selectedTrimIds.size}개 선택됨
                      </span>
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                        일괄 할인가 (만원)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={bulkDiscountInput}
                          onChange={e => setBulkDiscountInput(e.target.value)}
                          placeholder="0 또는 빈칸 = 할인 없음"
                          className="w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-white border border-amber-300 rounded-[6px] outline-none focus:border-amber-500 transition-colors placeholder:text-[#B0B8D0]"
                        />
                        {bulkDiscountRate > 0 && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-emerald-600">
                            -{bulkDiscountRate}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-amber-500">
                        {selectedTrims.length > 1
                          ? "선택한 트림들의 평균 가격 기준으로 할인율이 표시됩니다"
                          : selectedTrims.length === 1
                          ? `기준가: ${formatKRWMan(selectedTrims[0].price)}`
                          : "트림을 선택하세요"}
                      </p>
                    </div>
                    <button
                      onClick={handleBulkDiscount}
                      disabled={bulkSaving || selectedTrimIds.size === 0}
                      className="px-5 py-2 bg-amber-500 text-white rounded-[8px] text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
                    >
                      {bulkSaving ? "적용 중..." : "선택 트림에 적용"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTrims.map((trim) => {
              const discountRate = trim.discountPrice
                ? calcDiscountRate(trim.price, trim.discountPrice)
                : 0;
              const isSelected = selectedTrimIds.has(trim.id);

              return (
                <div
                  key={trim.id}
                  onClick={multiSelectMode ? () => toggleTrimSelect(trim.id) : undefined}
                  className={cn(
                    "bg-white border rounded-[12px] p-5 shadow-sm transition-all group relative",
                    multiSelectMode
                      ? "cursor-pointer select-none"
                      : "hover:border-[#000666]/30",
                    isSelected
                      ? "border-amber-400 bg-amber-50/50 shadow-amber-100"
                      : "border-[#E8EAF0]"
                  )}
                >
                  {/* 다중 선택 체크박스 */}
                  {multiSelectMode && (
                    <div className="absolute top-3 right-3">
                      {isSelected
                        ? <CheckSquare size={18} className="text-amber-500" />
                        : <Square size={18} className="text-[#C0C8E0]" />
                      }
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-[15px] font-bold text-[#1A1A2E]">{trim.name}</h4>
                      <p className="text-[12px] text-[#9BA4C0]">{trim.engineType}</p>
                    </div>
                    {!multiSelectMode && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(trim)}
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
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-[#F0F2F8]">
                    {trim.discountPrice && trim.discountPrice < trim.price ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[16px] font-extrabold text-[#000666]">
                            {formatKRWMan(trim.discountPrice)}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                            -{discountRate}%
                          </span>
                        </div>
                        <p className="text-[12px] text-[#9BA4C0] line-through">
                          {formatKRWMan(trim.price)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[16px] font-extrabold text-[#000666]">
                        {formatKRWMan(trim.price)}
                      </span>
                    )}
                    {trim.isDefault && (
                      <span className="absolute bottom-4 right-4 text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-[4px] font-bold uppercase tracking-wider">
                        Default
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
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
              onClick={closeModal}
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
                <button onClick={closeModal} className="text-[#9BA4C0] hover:text-[#1A1A2E]">
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
                      value={modalPriceInput}
                      onChange={e => setModalPriceInput(e.target.value)}
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

                {/* 할인가 입력 */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={11} />
                    할인가 (만원)
                    <span className="text-[10px] font-normal text-[#B0B8D0] normal-case tracking-normal">· 0 또는 빈칸 = 할인 없음</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={modalDiscountInput}
                      onChange={e => setModalDiscountInput(e.target.value)}
                      placeholder="미입력 시 할인 없음"
                      className={inputClass}
                    />
                    {modalDiscountRate > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-[4px]">
                        -{modalDiscountRate}%
                      </span>
                    )}
                  </div>
                  {modalDiscount > 0 && modalPrice > 0 && modalDiscount >= modalPrice && (
                    <p className="text-[11px] text-red-500">할인가는 원가보다 낮아야 합니다.</p>
                  )}
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
                    onClick={closeModal}
                    className="flex-1 py-3 bg-[#F4F5F8] text-[#4A5270] rounded-[8px] text-[14px] font-bold hover:bg-[#E8EAF0]"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saving || (modalDiscount > 0 && modalPrice > 0 && modalDiscount >= modalPrice)}
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
