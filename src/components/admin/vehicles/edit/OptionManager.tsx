"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { AdminTrimOption } from "@/types/admin";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

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

interface OptionManagerProps {
  /** 옵션이 속한 트림 ID */
  trimId: string;
  /** 수정 시 기존 옵션, 추가 시 null */
  target: AdminTrimOption | null;
  onClose: () => void;
}

export function OptionManager({ trimId, target, onClose }: OptionManagerProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      price: Number(fd.get("price")),
      category: (fd.get("category") as string) || null,
      isDefault: fd.get("isDefault") === "on",
      isAccessory: fd.get("isAccessory") === "on",
      description: (fd.get("description") as string) || null,
    };

    try {
      if (target) {
        await fetch(`/api/admin/trims/${trimId}/options/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`/api/admin/trims/${trimId}/options`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-[14px] w-[400px] p-6 shadow-xl"
      >
        <h3 className="text-[16px] font-bold text-[#1A1A2E] mb-4">
          {target ? "옵션 수정" : "옵션 추가"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="옵션명" required>
            <input
              name="name"
              defaultValue={target?.name}
              className={inputClass}
              placeholder="예: 파노라마 선루프"
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="추가 가격 (원)" required>
              <input
                name="price"
                type="number"
                defaultValue={target?.price ?? 0}
                className={inputClass}
              />
            </FormField>
            <FormField label="카테고리">
              <input
                name="category"
                defaultValue={target?.category ?? ""}
                className={inputClass}
                placeholder="예: 외관"
              />
            </FormField>
          </div>
          <FormField label="설명">
            <input
              name="description"
              defaultValue={target?.description ?? ""}
              className={inputClass}
              placeholder="옵션 설명 (선택)"
            />
          </FormField>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
              <input
                name="isDefault"
                type="checkbox"
                defaultChecked={target?.isDefault ?? false}
                className="accent-[#000666]"
              />
              기본 포함
            </label>
            <label className="flex items-center gap-2 text-[13px] text-[#4A5270] cursor-pointer">
              <input
                name="isAccessory"
                type="checkbox"
                defaultChecked={target?.isAccessory ?? false}
                className="accent-[#000666]"
              />
              액세서리
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-[6px] bg-[#000666] text-white text-[13px] font-medium disabled:opacity-50"
            >
              {saving ? "처리 중..." : target ? "저장" : "추가"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
