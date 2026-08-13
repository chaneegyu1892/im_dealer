"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Tags, X } from "lucide-react";
import type { AdminOptionBadge, AdminVehicleOptionBadgeRow } from "@/types/admin";

const inputClass =
  "w-full px-3 py-2 text-[13px] text-[#1A1A2E] bg-[#F8F9FC] border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] focus:bg-white transition-colors placeholder:text-[#B0B8D0]";

interface VehicleOptionBadgePanelProps {
  vehicleId: string;
  /** 추천 배지 라벨 목록(전역) */
  badges: AdminOptionBadge[];
  onClose: () => void;
}

/**
 * 차량 단위 옵션 배지 일괄 지정 패널.
 * 차량의 모든 트림 옵션을 이름 기준으로 중복 제거해 나열하고,
 * 옵션명마다 배지를 한 번만 지정하면 그 이름이 나오는 모든 트림에서 배지가 노출된다.
 */
export function VehicleOptionBadgePanel({ vehicleId, badges, onClose }: VehicleOptionBadgePanelProps) {
  const router = useRouter();
  const [rows, setRows] = useState<AdminVehicleOptionBadgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [savingName, setSavingName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // 초기 상태가 loading=true 이므로 여기서는 완료 시점만 갱신한다(마운트 시 1회 호출).
  const load = useCallback(async () => {
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicleId}/option-badges`);
      const json = await resp.json();
      if (json.success) {
        setRows(json.data);
      } else {
        setErrorMsg(json.error ?? "옵션 목록을 불러오지 못했습니다.");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("옵션 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = filter.trim();
    if (!keyword) return rows;
    return rows.filter((row) => row.name.includes(keyword));
  }, [rows, filter]);

  const badgedCount = useMemo(() => rows.filter((row) => row.badgeId).length, [rows]);

  const handleSet = async (optionName: string, badgeId: string | null) => {
    setSavingName(optionName);
    setErrorMsg(null);
    try {
      const resp = await fetch(`/api/admin/vehicles/${vehicleId}/option-badges`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionName, badgeId }),
      });
      const json = await resp.json();
      if (json.success) {
        setRows((prev) =>
          prev.map((row) => (row.name === optionName ? { ...row, badgeId } : row))
        );
        setDirty(true);
      } else {
        setErrorMsg(json.error ?? "배지 저장에 실패했습니다.");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("배지 저장에 실패했습니다.");
    } finally {
      setSavingName(null);
    }
  };

  const handleClose = () => {
    // 배지 표시는 SSR 데이터(옵션 테이블 칩)에도 반영되므로 변경이 있었으면 새로고침
    if (dirty) router.refresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white rounded-[14px] w-[620px] max-w-[94vw] shadow-xl overflow-hidden"
      >
        <div className="p-4 bg-[#F8F9FC] border-b border-[#E8EAF0] flex justify-between items-center">
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A2E] flex items-center gap-2">
              <Tags size={15} className="text-[#000666]" /> 옵션 배지 일괄 지정
            </h3>
            <p className="text-[11px] text-[#9BA4C0] mt-1">
              옵션명에 배지를 한 번만 지정하면, 그 옵션이 들어 있는 모든 트림에서 함께 노출됩니다.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[#9BA4C0] hover:text-[#1A1A2E] hover:bg-[#F0F2F8] rounded-[6px]"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-3 border-b border-[#F0F2F8] flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="옵션명 검색"
              className={`${inputClass} pl-8`}
            />
          </div>
          <span className="text-[12px] text-[#6B7399] whitespace-nowrap">
            전체 {rows.length}개 · 배지 {badgedCount}개
          </span>
        </div>

        {errorMsg && <p className="px-4 pt-3 text-[12px] text-red-500">{errorMsg}</p>}

        <div className="max-h-[56vh] overflow-y-auto divide-y divide-[#F0F2F8]">
          {loading ? (
            <div className="p-10 text-center text-[#9BA4C0] text-[13px]">불러오는 중...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-[#9BA4C0] text-[13px]">
              {rows.length === 0 ? "이 차량에 등록된 옵션이 없습니다." : "검색 결과가 없습니다."}
            </div>
          ) : (
            filtered.map((row) => (
              <div key={row.name} className="px-4 py-2.5 flex items-center gap-3 hover:bg-[#F8F9FC] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-semibold text-[#1A1A2E]">{row.name}</span>
                    {row.isAccessory && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100">
                        ACC
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9BA4C0] mt-0.5">
                    {row.category ? `${row.category} · ` : ""}트림 {row.trimCount}개에 포함
                  </p>
                </div>
                <select
                  value={row.badgeId ?? ""}
                  disabled={savingName === row.name}
                  onChange={(e) => handleSet(row.name, e.target.value || null)}
                  className="w-[130px] px-2 py-1.5 text-[12px] text-[#1A1A2E] bg-white border border-[#E8EAF0] rounded-[6px] outline-none focus:border-[#000666] disabled:opacity-50"
                >
                  <option value="">배지 없음</option>
                  {badges.map((badge) => (
                    <option key={badge.id} value={badge.id}>
                      {badge.label}
                    </option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-[#E8EAF0] flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-[6px] bg-[#F4F5F8] text-[#4A5270] text-[13px] font-medium hover:bg-[#ECEEF5]"
          >
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  );
}
