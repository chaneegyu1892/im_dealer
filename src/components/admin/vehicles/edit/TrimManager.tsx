"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatKRWMan } from "@/lib/format";
import type { AdminVehicleDetail, AdminTrim, AdminTrimOption } from "@/types/admin";
import { OptionManager } from "./OptionManager";

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

interface TrimManagerProps {
  vehicle: AdminVehicleDetail;
}

export function TrimManager({ vehicle }: TrimManagerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [trimModal, setTrimModal] = useState<{ isOpen: boolean; target: AdminTrim | null }>(
    { isOpen: false, target: null }
  );
  const [optionModal, setOptionModal] = useState<{
    isOpen: boolean;
    trimId: string;
    target: AdminTrimOption | null;
  }>({ isOpen: false, trimId: "", target: null });
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "trim" | "option";
    id: string;
    trimId?: string;
    name: string;
  } | null>(null);

  const handleSaveTrim = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      price: Number(fd.get("price")) * 10000,
      engineType: fd.get("engineType") as string,
      isDefault: fd.get("isDefault") === "on",
      isVisible: fd.get("isVisible") === "on",
      fuelEfficiency: fd.get("fuelEfficiency") ? Number(fd.get("fuelEfficiency")) : null,
    };

    try {
      if (trimModal.target) {
        await fetch(`/api/admin/vehicles/${vehicle.id}/trims/${trimModal.target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/admin/vehicles/${vehicle.id}/trims`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setTrimModal({ isOpen: false, target: null });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.type === "trim") {
        await fetch(`/api/admin/vehicles/${vehicle.id}/trims/${deleteTarget.id}`, {
          method: "DELETE",
        });
      } else {
        await fetch(`/api/admin/trims/${deleteTarget.trimId}/options/${deleteTarget.id}`, {
          method: "DELETE",
        });
      }
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* 트림 목록 */}
      <div className="bg-white rounded-[14px] border border-[#E8EAF0] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E8EAF0] flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#1A1A2E]">
            트림 ({vehicle.trims.length})
          </h2>
          <button
            onClick={() => setTrimModal({ isOpen: true, target: null })}
            className="w-6 h-6 flex items-center justify-center rounded-[6px] hover:bg-[#F0F2F8] text-[#000666]"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="divide-y divide-[#F0F2F8]">
          {vehicle.trims.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[#9BA4C0]">
              등록된 트림이 없습니다
            </p>
          ) : (
            vehicle.trims.map((trim) => (
              <div key={trim.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1A1A2E]">{trim.name}</span>
                    {trim.isDefault && (
                      <span className="text-[10px] bg-[#E5E5FA] text-[#000666] px-1.5 py-0.5 rounded-[4px] font-medium">
                        기본
                      </span>
                    )}
                    <span className="text-[10px] text-[#6B7399] bg-[#F4F5F8] px-1.5 py-0.5 rounded-[4px]">
                      {trim.engineType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] text-[#4A5270] font-medium mr-2">
                      {formatKRWMan(trim.price)}
                    </span>
                    <button
                      onClick={() => setTrimModal({ isOpen: true, target: trim })}
                      className="p-1 rounded hover:bg-[#F0F2F8] text-[#9BA4C0] hover:text-[#000666]"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ type: "trim", id: trim.id, name: trim.name })}
                      className="p-1 rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* 트림 내 옵션 목록 */}
                {trim.options.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {trim.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between text-[12px] py-1"
                      >
                        <span className="text-[#6B7399]">
                          {opt.name}
                          {opt.category && (
                            <span className="text-[#9BA4C0] ml-1">({opt.category})</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#4A5270]">+{opt.price.toLocaleString()}원</span>
                          <button
                            onClick={() => setOptionModal({ isOpen: true, trimId: trim.id, target: opt })}
                            className="p-0.5 rounded hover:bg-[#F0F2F8] text-[#9BA4C0] hover:text-[#000666]"
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteTarget({ type: "option", id: opt.id, trimId: trim.id, name: opt.name })
                            }
                            className="p-0.5 rounded hover:bg-red-50 text-[#9BA4C0] hover:text-red-500"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setOptionModal({ isOpen: true, trimId: trim.id, target: null })}
                  className="mt-2 ml-4 flex items-center gap-1 text-[11px] text-[#000666] hover:underline"
                >
                  <Plus size={10} /> 옵션 추가
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 트림 추가/수정 모달 */}
      {trimModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setTrimModal({ isOpen: false, target: null })}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white rounded-[14px] w-[420px] p-6 shadow-xl"
          >
            <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-4">
              {trimModal.target ? "트림 수정" : "트림 추가"}
            </h3>
            <form onSubmit={handleSaveTrim} className="space-y-4">
              <FormField label="트림명" required>
                <input
                  name="name"
                  defaultValue={trimModal.target?.name}
                  className={inputClass}
                  placeholder="예: 프리미엄"
                  autoFocus
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="가격 (만원)" required>
                  <input
                    name="price"
                    type="number"
                    defaultValue={trimModal.target ? trimModal.target.price / 10000 : ""}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="엔진 타입" required>
                  <select
                    name="engineType"
                    defaultValue={trimModal.target?.engineType ?? "가솔린"}
                    className={selectClass}
                  >
                    {["가솔린", "디젤", "하이브리드", "EV"].map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </FormField>
              </div>
              <FormField label="연비 (km/L)">
                <input
                  name="fuelEfficiency"
                  type="number"
                  step="0.1"
                  defaultValue={trimModal.target?.fuelEfficiency ?? ""}
                  className={inputClass}
                />
              </FormField>
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
                  <input
                    name="isDefault"
                    type="checkbox"
                    defaultChecked={trimModal.target?.isDefault ?? false}
                    className="accent-[#000666]"
                  />
                  기본 트림
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
                  <input
                    name="isVisible"
                    type="checkbox"
                    defaultChecked={trimModal.target?.isVisible ?? true}
                    className="accent-[#000666]"
                  />
                  노출
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTrimModal({ isOpen: false, target: null })}
                  className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-[6px] bg-[#000666] text-white text-[13px] font-medium disabled:opacity-50"
                >
                  {saving ? "처리 중..." : trimModal.target ? "저장" : "추가"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 옵션 추가/수정 모달 (OptionManager) */}
      {optionModal.isOpen && (
        <OptionManager
          trimId={optionModal.trimId}
          target={optionModal.target}
          onClose={() => setOptionModal({ isOpen: false, trimId: "", target: null })}
        />
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-[12px] p-6 w-[340px] shadow-xl"
          >
            <h3 className="text-[15px] font-semibold text-[#1A1A2E] mb-2">
              {deleteTarget.type === "trim" ? "트림 삭제" : "옵션 삭제"}
            </h3>
            <p className="text-[13px] text-[#6B7399] mb-5">
              <strong className="text-[#1A1A2E]">{deleteTarget.name}</strong>을(를) 삭제하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-2 rounded-[6px] bg-red-600 text-white text-[13px] font-medium disabled:opacity-50"
              >
                {saving ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
