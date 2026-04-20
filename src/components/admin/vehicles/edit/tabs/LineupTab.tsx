"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AdminVehicleDetail, AdminVehicleLineup } from "@/types/admin";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

interface LineupTabProps {
  vehicle: AdminVehicleDetail;
}

export function LineupTab({ vehicle }: LineupTabProps) {
  const [lineups, setLineups] = useState<AdminVehicleLineup[]>(vehicle.lineups);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicle.id}/lineups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      const result = await resp.json();
      if (result.success) {
        setLineups([...lineups, result.data]);
        setIsAdding(false);
        setEditName("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim() || saving) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicle.id}/lineups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName }),
      });
      const result = await resp.json();
      if (result.success) {
        setLineups(lineups.map(l => l.id === id ? result.data : l));
        setEditingId(null);
        setEditName("");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 라인업을 삭제하시겠습니까? 관련 트림도 모두 삭제될 수 있습니다.")) return;
    setSaving(true);
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicle.id}/lineups/${id}`, {
        method: "DELETE",
      });
      const result = await resp.json();
      if (result.success) {
        setLineups(lineups.filter(l => l.id !== id));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[800px] space-y-6">
      <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm overflow-hidden">
        <div className="p-4 bg-[#F8F9FC] border-b border-[#E8EAF0] flex justify-between items-center">
          <h3 className="text-[14px] font-bold text-[#1A1A2E]">차량 라인업 구성 ({lineups.length})</h3>
          <button
            onClick={() => { setIsAdding(true); setEditName(""); setEditingId(null); }}
            className="flex items-center gap-1.5 bg-[#000666] text-white px-3 py-1.5 rounded-[6px] text-[12px] font-medium hover:bg-[#1A1A6E]"
          >
            <Plus size={14} /> 라인업 추가
          </button>
        </div>

        <div className="divide-y divide-[#F0F2F8]">
          <AnimatePresence mode="popLayout">
            {isAdding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-emerald-50/30 flex items-center gap-3"
              >
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="예: 2024 가솔린"
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
              </motion.div>
            )}

            {lineups.length === 0 && !isAdding ? (
              <div className="p-8 text-center text-[#9BA4C0] text-[13px]">
                등록된 라인업이 없습니다. 우측 상단 버튼을 눌러 추가해주세요.
              </div>
            ) : (
              lineups.map((lineup) => (
                <div key={lineup.id} className="p-4 flex items-center justify-between group hover:bg-[#F8F9FC] transition-colors">
                  {editingId === lineup.id ? (
                    <div className="flex-1 flex items-center gap-3">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(lineup.id)}
                      />
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(lineup.id)} disabled={saving} className="p-2 bg-[#000666] text-white rounded-[6px] hover:bg-[#1A1A6E] disabled:opacity-50">
                          <Save size={16} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 bg-white border border-[#E8EAF0] text-[#9BA4C0] rounded-[6px] hover:bg-[#F4F5F8]">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#E5E5FA] flex items-center justify-center text-[#000666] text-[12px] font-bold">
                          L
                        </div>
                        <span className="text-[14px] font-medium text-[#1A1A2E]">{lineup.name}</span>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingId(lineup.id); setEditName(lineup.name); setIsAdding(false); }}
                          className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(lineup.id)}
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
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
