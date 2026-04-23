"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AdminTrimOption } from "@/types/admin";

const selectClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors appearance-none cursor-pointer";

interface OptionRuleModalProps {
  trimId: string;
  options: AdminTrimOption[];
  onClose: () => void;
}

export function OptionRuleModal({ trimId, options, onClose }: OptionRuleModalProps) {
  const [ruleType, setRuleType] = useState<"REQUIRED"| "INCLUDED" | "CONFLICT">("REQUIRED");
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !targetId || saving) return;
    if (sourceId === targetId) {
      alert("기준 옵션과 대상 옵션이 같을 수 없습니다.");
      return;
    }

    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/trims/${trimId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType, sourceOptionId: sourceId, targetOptionId: targetId }),
      });
      if (resp.ok) {
        onClose();
        window.location.reload();
      } else {
        const err = await resp.json();
        alert(err.error || "규칙 저장 중 오류가 발생했습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white rounded-[16px] w-full max-w-[420px] shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-[#F0F2F8] bg-[#F8F9FC] flex justify-between items-center">
          <h3 className="text-[16px] font-bold text-[#1A1A2E]">옵션 규칙 추가</h3>
          <button onClick={onClose} className="text-[#9BA4C0] hover:text-[#1A1A2E]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider text-center block">규칙 유형</label>
            <div className="flex gap-2 p-1 bg-[#F8F9FC] border border-[#E8EAF0] rounded-[8px]">
              {(["REQUIRED", "INCLUDED", "CONFLICT"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRuleType(type)}
                  className={cn(
                    "flex-1 py-2 text-[12px] font-bold rounded-[6px] transition-all",
                    ruleType === type 
                      ? "bg-[#000666] text-white shadow-sm" 
                      : "text-[#6B7399] hover:bg-[#F0F2F8]"
                  )}
                >
                  {type === "REQUIRED" ? "필수" : type === "INCLUDED" ? "포함" : "충돌"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-center text-[#9BA4C0] pt-1">
              {ruleType === "REQUIRED" && "기준 옵션 선택 시 대상 옵션이 반드시 필요함"}
              {ruleType === "INCLUDED" && "기준 옵션 선택 시 대상 옵션이 자동 포함됨"}
              {ruleType === "CONFLICT" && "기준 옵션과 대상 옵션은 동시에 선택 불가 (양방향 적용)"}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#6B7399] uppercase">기준 옵션</label>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={selectClass} required>
                <option value="">옵션 선택...</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="flex justify-center text-[#D0D5E8]">
              <div className="h-6 w-[2px] bg-current" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#6B7399] uppercase">대상 옵션</label>
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className={selectClass} required>
                <option value="">옵션 선택...</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-[#F4F5F8] text-[#4A5270] rounded-[8px] text-[14px] font-bold hover:bg-[#E8EAF0]"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || !sourceId || !targetId}
              className="flex-1 py-3 bg-[#000666] text-white rounded-[8px] text-[14px] font-bold hover:bg-[#1A1A6E] shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "규칙 저장"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
