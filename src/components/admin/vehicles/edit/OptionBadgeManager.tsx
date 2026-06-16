"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X, Tag } from "lucide-react";
import type { AdminOptionBadge } from "@/types/admin";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

interface OptionBadgeManagerProps {
  badges: AdminOptionBadge[];
  /** 배지 목록 변경 후 상위에서 재조회 */
  onChange: () => void;
  onClose: () => void;
}

export function OptionBadgeManager({ badges, onChange, onClose }: OptionBadgeManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!label.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const resp = await fetch("/api/admin/option-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), displayOrder: badges.length }),
      });
      const result = await resp.json();
      if (result.success) {
        setIsAdding(false);
        setLabel("");
        onChange();
      } else {
        setErrorMsg(result.error ?? "배지 추가에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!label.trim() || saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(`/api/admin/option-badges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      const result = await resp.json();
      if (result.success) {
        setEditingId(null);
        setLabel("");
        onChange();
      } else {
        setErrorMsg(result.error ?? "배지 수정에 실패했습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 배지를 삭제하시겠습니까? 이 배지를 사용 중인 옵션에서는 배지가 해제됩니다.")) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/option-badges/${id}`, { method: "DELETE" });
      const result = await resp.json();
      if (result.success) onChange();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-[14px] w-[440px] max-w-[92vw] shadow-xl overflow-hidden"
      >
        <div className="p-4 bg-[#F8F9FC] border-b border-[#E8EAF0] flex justify-between items-center">
          <h3 className="text-[14px] font-bold text-[#1A1A2E] flex items-center gap-2">
            <Tag size={15} className="text-[#000666]" /> 추천 배지 관리
          </h3>
          <button
            onClick={() => { setIsAdding(true); setLabel(""); setEditingId(null); setErrorMsg(null); }}
            className="flex items-center gap-1.5 bg-[#000666] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#1A1A6E]"
          >
            <Plus size={14} /> 배지 추가
          </button>
        </div>

        {errorMsg && (
          <p className="px-4 pt-3 text-[12px] text-red-500">{errorMsg}</p>
        )}

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#F0F2F8]">
          {isAdding && (
            <div className="p-4 bg-emerald-50/30 flex items-center gap-3">
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="예: 추천 / 인기 / 베스트"
                maxLength={20}
                className={inputClass}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <div className="flex gap-1">
                <button onClick={handleAdd} disabled={saving} className="p-2 bg-[#000666] text-white rounded-[6px] hover:bg-[#1A1A6E] disabled:opacity-50">
                  <Save size={16} />
                </button>
                <button onClick={() => setIsAdding(false)} className="p-2 bg-white border border-[#E8EAF0] text-[#9BA4C0] rounded-[6px] hover:bg-[#F4F5F8]">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {badges.length === 0 && !isAdding ? (
            <div className="p-8 text-center text-[#9BA4C0] text-[13px]">
              등록된 배지가 없습니다. 우측 상단 버튼으로 추가해주세요.
            </div>
          ) : (
            badges.map((badge) => (
              <div key={badge.id} className="p-3 flex items-center justify-between group hover:bg-[#F8F9FC] transition-colors">
                {editingId === badge.id ? (
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      autoFocus
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      maxLength={20}
                      className={inputClass}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(badge.id)}
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdate(badge.id)} disabled={saving} className="p-2 bg-[#000666] text-white rounded-[6px] hover:bg-[#1A1A6E] disabled:opacity-50">
                        <Save size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 bg-white border border-[#E8EAF0] text-[#9BA4C0] rounded-[6px] hover:bg-[#F4F5F8]">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="inline-flex items-center text-[12px] font-semibold text-[#000666] bg-[#E5E5FA] px-2 py-1 rounded-[4px]">
                      {badge.label}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(badge.id); setLabel(badge.label); setIsAdding(false); setErrorMsg(null); }}
                        className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px]"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(badge.id)}
                        className="p-1.5 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[6px]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[#E8EAF0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium hover:bg-[#ECEEF5]"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
