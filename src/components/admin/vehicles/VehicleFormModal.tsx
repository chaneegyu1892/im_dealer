"use client";

import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import type { AdminVehicle } from "@/types/admin";
import type { VehicleCategory } from "@/types/vehicle";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";
const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[#6B7399] mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── 차량 생성/수정 모달 ─────────────────────────────────

interface VehicleFormModalProps {
  target: AdminVehicle | null;
  selectedBrand: string | null;
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

export function VehicleFormModal({
  target,
  selectedBrand,
  saving,
  onSubmit,
  onClose,
}: VehicleFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-[14px] w-[460px] p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-5">
          {target ? "차량 기본 정보 변경" : "차량 등록"}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="브랜드">
            <input
              value={selectedBrand ?? ""}
              disabled
              className={`${inputClass} opacity-70`}
            />
          </FormField>
          <FormField label="차량명" required>
            <input
              name="name"
              defaultValue={target?.name}
              className={inputClass}
              placeholder="예: 쏘렌토"
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="분류">
              <select
                name="category"
                defaultValue={target?.category ?? "SUV"}
                className={selectClass}
              >
                {(["세단", "SUV", "밴", "트럭"] as VehicleCategory[]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="기준 가격 (만원)" required>
              <input
                name="basePrice"
                type="number"
                defaultValue={target ? target.basePrice / 10000 : ""}
                className={inputClass}
                placeholder="예: 3500"
              />
            </FormField>
          </div>
          <p className="text-[11px] text-[#9BA4C0] pt-2 flex items-start gap-1">
            <AlertCircle size={12} className="mt-[2px]" />
            트림·엔진타입·이미지는 생성 후 &apos;상세 정보 변경&apos;에서 설정합니다.
          </p>
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium hover:bg-[#EAEDF5]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-[6px] bg-[#000666] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "처리 중..." : target ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── 차량 삭제 확인 모달 ─────────────────────────────────

interface DeleteVehicleModalProps {
  name: string;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteVehicleModal({
  name,
  saving,
  onConfirm,
  onClose,
}: DeleteVehicleModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-white rounded-[12px] p-6 w-[340px] shadow-xl"
      >
        <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-2">차량 삭제</h3>
        <p className="text-[13px] text-[#6B7399] mb-5">
          <strong className="text-[#1A1A2E]">{name}</strong>을(를) 삭제하시겠습니까?
          관련 트림과 옵션도 함께 삭제됩니다.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-2 rounded-[6px] bg-red-600 text-white text-[13px] font-medium disabled:opacity-50"
          >
            {saving ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
