"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, ChevronDown, Check } from "lucide-react";
import { VEHICLE_BRANDS, VehicleCategory } from "@/constants/mock-data";
import { cn } from "@/lib/utils";

interface BatchUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (params: { 
    brand: string; 
    category: string; 
    adjustmentType: "increase" | "decrease"; 
    value: number;
    reason: string;
  }) => void;
}

const CATEGORIES: VehicleCategory[] = [
  "국산 EV", "국산 HEV", "국산 가솔린", "수입 EV", "수입 HEV", "수입 가솔린/디젤"
];

export function BatchUpdateModal({ isOpen, onClose, onApply }: BatchUpdateModalProps) {
  const [targetBrand, setTargetBrand] = useState("전체");
  const [targetCategory, setTargetCategory] = useState("전체");
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("increase");
  const [adjustmentValue, setAdjustmentValue] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentValue) return;
    
    onApply({
      brand: targetBrand,
      category: targetCategory,
      adjustmentType,
      value: Number(adjustmentValue),
      reason,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
          />
          <div className="fixed inset-0 flex items-center justify-center z-[70] pointer-events-none p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-[480px] bg-white rounded-[20px] shadow-2xl overflow-hidden pointer-events-auto"
            >
            <div className="px-6 py-5 border-b border-[#F0F2F8] flex items-center justify-between bg-[#F8F9FC]">
              <div>
                <h2 className="text-[16px] font-bold text-[#1A1A2E]">일괄 회수율 조정</h2>
                <p className="text-[11px] text-[#8890AA] mt-0.5">선택한 카테고리의 회수율을 한 번에 수정합니다.</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-[#E8EAF0] rounded-full transition-colors text-[#9BA4C0]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* 대상 설정 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-[#4A5270] ml-1">대상 브랜드</label>
                  <div className="relative">
                    <select
                      value={targetBrand}
                      onChange={(e) => setTargetBrand(e.target.value)}
                      className="w-full h-10 pl-3 pr-8 bg-white border border-[#E8EAF0] rounded-[10px] text-[13px] text-[#1A1A2E] appearance-none focus:outline-none focus:border-[#000666] transition-colors"
                    >
                      <option value="전체">전체 브랜드</option>
                      {VEHICLE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-[#4A5270] ml-1">대상 카테고리</label>
                  <div className="relative">
                    <select
                      value={targetCategory}
                      onChange={(e) => setTargetCategory(e.target.value)}
                      className="w-full h-10 pl-3 pr-8 bg-white border border-[#E8EAF0] rounded-[10px] text-[13px] text-[#1A1A2E] appearance-none focus:outline-none focus:border-[#000666] transition-colors"
                    >
                      <option value="전체">전체 카테고리</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* 조정 값 설정 */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[12px] font-semibold text-[#4A5270] ml-1">조정 방식 및 수치</label>
                <div className="flex gap-2">
                  <div className="flex flex-1 p-1 bg-[#F4F5F8] rounded-[10px]">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType("increase")}
                      className={cn(
                        "flex-1 h-8 text-[12px] font-medium rounded-[7px] transition-all",
                        adjustmentType === "increase" ? "bg-white text-[#000666] shadow-sm" : "text-[#8890AA] hover:text-[#4A5270]"
                      )}
                    >
                      상향 (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType("decrease")}
                      className={cn(
                        "flex-1 h-8 text-[12px] font-medium rounded-[7px] transition-all",
                        adjustmentType === "decrease" ? "bg-white text-[#E11D48] shadow-sm" : "text-[#8890AA] hover:text-[#4A5270]"
                      )}
                    >
                      하향 (-)
                    </button>
                  </div>
                  <div className="relative w-[120px]">
                    <input
                      type="number"
                      value={adjustmentValue}
                      onChange={(e) => setAdjustmentValue(e.target.value)}
                      placeholder="0.0"
                      className="w-full h-10 pl-3 pr-8 bg-white border border-[#E8EAF0] rounded-[10px] text-[14px] font-bold text-[#1A1A2E] focus:outline-none focus:border-[#000666]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#9BA4C0]">%</span>
                  </div>
                </div>
              </div>

              {/* 사유 */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#4A5270] ml-1">변경 사유</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 2026년 2분기 시장가치 하락분 반영"
                  className="w-full h-24 p-3 bg-white border border-[#E8EAF0] rounded-[12px] text-[13px] text-[#1A1A2E] focus:outline-none focus:border-[#000666] resize-none placeholder:text-[#B0B5D0]"
                />
              </div>

              <div className="bg-[#FFFBEB] border border-[#FEF3C7] rounded-[12px] p-3.5 flex items-start gap-3">
                <AlertCircle size={16} className="text-[#D97706] shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-[#92400E]">
                  <b>주의:</b> 일괄 적용 시 현재 필터링된 조건에 해당하는 모든 차종의 연식/주행거리별 회수율이 동일하게 조정됩니다. 이 작업은 취소할 수 있으나 신중하게 진행해주세요.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 rounded-[12px] bg-[#F4F5F8] text-[#4A5270] text-[14px] font-semibold hover:bg-[#E8EAF0] transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!adjustmentValue}
                  className="flex-1 h-11 rounded-[12px] bg-[#000666] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-30"
                >
                  <Check size={16} />
                  적용하기
                </button>
              </div>
            </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
