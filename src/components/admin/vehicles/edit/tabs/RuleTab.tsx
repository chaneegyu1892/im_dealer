"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Check, ChevronRight, AlertCircle, Link2, Ban, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminVehicleDetail, AdminOptionRule } from "@/types/admin";
import { motion, AnimatePresence } from "framer-motion";
import { OptionRuleModal } from "./OptionRuleModal";

interface RuleTabProps {
  vehicle: AdminVehicleDetail;
}

export function RuleTab({ vehicle }: RuleTabProps) {
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
  const rules = selectedTrim?.rules ?? [];
  const options = selectedTrim?.options ?? [];

  const [modalOpen, setModalOpen] = useState(false);

  const handleDelete = async (ruleId: string) => {
    if (!confirm("이 규칙을 삭제하시겠습니까? (충돌 규칙의 경우 쌍방향 규칙이 모두 삭제됩니다)")) return;
    await fetch(`/api/admin/trims/${selectedTrimId}/rules/${ruleId}`, { method: "DELETE" });
    window.location.reload();
  };

  const getOptionName = (id: string) => options.find(o => o.id === id)?.name ?? "삭제된 옵션";

  const RULE_INFO = {
    REQUIRED: { label: "필수", color: "text-blue-600", bg: "bg-blue-50", icon: AlertCircle },
    INCLUDED: { label: "포함", color: "text-emerald-600", bg: "bg-emerald-50", icon: Link2 },
    CONFLICT: { label: "충돌", color: "text-red-600", bg: "bg-red-50", icon: Ban },
  };

  return (
    <div className="space-y-6">
      {/* 계층형 선택기 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm space-y-3">
          <h4 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider">1. 라인업 선택</h4>
          <div className="flex flex-wrap gap-2">
            {vehicle.lineups.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedLineupId(l.id)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all",
                  selectedLineupId === l.id ? "bg-[#000666] text-white" : "bg-[#F8F9FC] text-[#6B7399] border border-[#E8EAF0]"
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white p-4 rounded-[12px] border border-[#E8EAF0] shadow-sm space-y-3">
          <h4 className="text-[12px] font-bold text-[#6B7399] uppercase tracking-wider">2. 트림 선택</h4>
          <div className="flex flex-wrap gap-2">
            {trimsOfLineup.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTrimId(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all flex items-center gap-1.5",
                  selectedTrimId === t.id ? "bg-[#000666] text-white" : "bg-[#F8F9FC] text-[#6B7399] border border-[#E8EAF0]"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedTrimId ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#F8F9FC] p-4 rounded-[12px] border border-[#E8EAF0]">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A2E]">
              <span className="text-[#000666]">{selectedTrim?.name}</span>
              <ChevronRight size={14} className="text-[#9BA4C0]" />
              <span className="text-[#000666]">옵션 규칙 관리</span>
              <span className="ml-2 px-2 py-0.5 bg-white text-[11px] rounded-[4px] border border-[#E8EAF0]">총 {rules.length}개</span>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 bg-[#000666] text-white px-4 py-2 rounded-[8px] text-[13px] font-medium hover:bg-[#1A1A6E]"
            >
              <PlusCircle size={16} /> 규칙 추가
            </button>
          </div>

          <div className="bg-white border border-[#E8EAF0] rounded-[12px] overflow-hidden shadow-sm">
            <div className="divide-y divide-[#F0F2F8]">
              {rules.length === 0 ? (
                <div className="p-12 text-center text-[#9BA4C0] text-[13px]">
                  설정된 옵션 규칙이 없습니다.
                </div>
              ) : (
                rules.map((rule) => {
                  const info = RULE_INFO[rule.ruleType as keyof typeof RULE_INFO];
                  const Icon = info.icon;
                  return (
                    <div key={rule.id} className="p-5 flex items-center justify-between hover:bg-[#F8F9FC]/50 transition-colors group">
                      <div className="flex items-center gap-6">
                        <div className={cn("flex flex-col items-center justify-center w-[60px] h-[60px] rounded-[12px]", info.bg)}>
                          <Icon className={info.color} size={24} strokeWidth={2.5} />
                          <span className={cn("text-[10px] font-bold mt-1", info.color)}>{info.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-[#6B7399] uppercase">기준 옵션</span>
                            <span className="text-[14px] font-bold text-[#1A1A2E]">{getOptionName(rule.sourceOptionId)}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 text-[#D0D5E8]">
                            <div className="w-8 h-[2px] bg-current" />
                            <ChevronRight size={16} />
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-[#6B7399] uppercase">대상 옵션</span>
                            <span className="text-[14px] font-bold text-[#1A1A2E]">{getOptionName(rule.targetOptionId)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-2 text-[#9BA4C0] hover:text-red-500 hover:bg-red-50 rounded-[8px] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-[12px] border border-dashed border-[#E8EAF0]">
          <p className="text-[#9BA4C0] text-[14px]">트림을 먼저 등록하거나 선택해주세요.</p>
        </div>
      )}

      {modalOpen && (
        <OptionRuleModal
          trimId={selectedTrimId}
          options={options}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
