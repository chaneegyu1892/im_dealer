"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  AdminFinanceCompany,
  AdminVehicle,
  CapitalRateSheet,
} from "@/types/admin";
import RateInputForm from "./RateInputForm";
import RateHistory from "./RateHistory";

interface VehicleLineup {
  id: string;
  name: string;
}

interface TrimBasic {
  id: string;
  name: string;
  price: number;
  lineupId: string | null;
}

interface VehicleWithLineups {
  id: string;
  name: string;
  brand: string;
  lineups: VehicleLineup[];
  trims: TrimBasic[];
}

interface Props {
  financeCompanies: AdminFinanceCompany[];
  vehicles: AdminVehicle[];
}

export default function CapitalRateManager({ financeCompanies, vehicles }: Props) {
  const [selectedFcId, setSelectedFcId] = useState<string>(financeCompanies[0]?.id ?? "");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const vehiclesByBrand = useMemo(() => {
    const map = new Map<string, AdminVehicle[]>();
    for (const v of vehicles) {
      const list = map.get(v.brand) ?? [];
      list.push(v);
      map.set(v.brand, list);
    }
    return map;
  }, [vehicles]);

  const toggleBrand = useCallback((brand: string) => {
    setExpandedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  }, []);
  const [vehicleDetail, setVehicleDetail] = useState<VehicleWithLineups | null>(null);
  const [selectedLineupId, setSelectedLineupId] = useState<string>("");
  const [selectedTrimId, setSelectedTrimId] = useState<string>("");
  const [activeSheets, setActiveSheets] = useState<CapitalRateSheet[]>([]);
  const [historySheets, setHistorySheets] = useState<CapitalRateSheet[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const selectedFc = financeCompanies.find((f) => f.id === selectedFcId);

  // 차량 선택 시 상세(라인업+트림) 로드
  useEffect(() => {
    if (!selectedVehicleId) {
      setVehicleDetail(null);
      setSelectedLineupId("");
      setSelectedTrimId("");
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/admin/vehicles/${selectedVehicleId}`)
      .then((r) => r.json())
      .then((res) => {
        const vehicle = res.data ?? res; // { success, data } 또는 직접 vehicle
        setVehicleDetail(vehicle);
        const firstLineup = vehicle.lineups?.[0];
        setSelectedLineupId(firstLineup?.id ?? "");
        setSelectedTrimId("");
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedVehicleId]);

  // 라인업 변경 시 트림 초기화
  useEffect(() => { setSelectedTrimId(""); }, [selectedLineupId]);

  // 현재 라인업의 트림 목록
  const trimsInLineup = useMemo<TrimBasic[]>(() => {
    if (!vehicleDetail) return [];
    return vehicleDetail.trims.filter((t) => t.lineupId === selectedLineupId);
  }, [vehicleDetail, selectedLineupId]);

  const selectedTrim = trimsInLineup.find((t) => t.id === selectedTrimId);

  // 활성 시트 로드 (캐피탈사 선택 시)
  useEffect(() => {
    if (!selectedFcId) return;
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}`)
      .then((r) => r.json())
      .then(setActiveSheets)
      .catch(console.error);
  }, [selectedFcId]);

  // 이력 로드
  useEffect(() => {
    if (!selectedFcId || !selectedTrimId || !showHistory) return;
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}&trimId=${selectedTrimId}&history=true`)
      .then((r) => r.json())
      .then(setHistorySheets)
      .catch(console.error);
  }, [selectedFcId, selectedTrimId, showHistory]);

  const currentSheet = activeSheets.find((s) => s.trimId === selectedTrimId);

  const handleSaved = () => {
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}`)
      .then((r) => r.json())
      .then(setActiveSheets);
    if (showHistory) {
      fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}&trimId=${selectedTrimId}&history=true`)
        .then((r) => r.json())
        .then(setHistorySheets);
    }
  };

  const handleActivate = async (sheetId: string) => {
    await fetch(`/api/admin/capital-rates/${sheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setActive: true }),
    });
    handleSaved();
  };

  const handleDelete = async (sheetId: string) => {
    if (!confirm("이 시트를 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/capital-rates/${sheetId}`, { method: "DELETE" });
    handleSaved();
  };

  return (
    <div className="flex gap-6 h-full">
      {/* ── 좌측: 캐피탈사 + 차량/라인업/트림 선택 ── */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        {/* 캐피탈사 선택 */}
        <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
          <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider mb-3">캐피탈사</p>
          <div className="flex flex-col gap-1">
            {financeCompanies.map((fc) => (
              <button
                key={fc.id}
                onClick={() => setSelectedFcId(fc.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedFcId === fc.id
                    ? "bg-[#000666] text-white"
                    : "text-[#1A1A2E] hover:bg-[#F0F1FA]"
                }`}
              >
                <span>{fc.name}</span>
                {!fc.isActive && (
                  <span className="ml-2 text-xs text-[#9BA4C0]">(비활성)</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 차량 선택 — 브랜드별 그룹 */}
        <div className="bg-white rounded-xl border border-[#E8EAF2] p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider mb-3">차량</p>
          <div className="flex flex-col gap-0.5">
            {Array.from(vehiclesByBrand.entries()).map(([brand, brandVehicles]) => {
              const isExpanded = expandedBrands.has(brand);
              const hasSelected = brandVehicles.some((v) => v.id === selectedVehicleId);
              return (
                <div key={brand}>
                  <button
                    onClick={() => toggleBrand(brand)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      hasSelected
                        ? "text-[#000666] bg-[#F0F1FA]"
                        : "text-[#9BA4C0] hover:bg-[#F8F9FC]"
                    }`}
                  >
                    <span>{brand}</span>
                    <span className="text-[10px]">{isExpanded ? "▲" : "▼"} {brandVehicles.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-2 flex flex-col gap-0.5 mt-0.5">
                      {brandVehicles.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedVehicleId(v.id);
                            setShowHistory(false);
                          }}
                          className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                            selectedVehicleId === v.id
                              ? "bg-[#6066EE] text-white font-medium"
                              : "text-[#1A1A2E] hover:bg-[#F8F9FC]"
                          }`}
                        >
                          {v.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 우측: 라인업/트림 선택 + 입력 폼 ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {selectedVehicleId && vehicleDetail ? (
          <>
            {/* 라인업 탭 */}
            {vehicleDetail.lineups.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
                <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider mb-3">라인업</p>
                <div className="flex flex-wrap gap-2">
                  {vehicleDetail.lineups.map((lineup: VehicleLineup) => (
                    <button
                      key={lineup.id}
                      onClick={() => setSelectedLineupId(lineup.id)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedLineupId === lineup.id
                          ? "bg-[#000666] text-white border-[#000666]"
                          : "text-[#1A1A2E] border-[#E8EAF2] hover:border-[#6066EE]"
                      }`}
                    >
                      {lineup.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 트림 선택 */}
            {selectedLineupId && trimsInLineup.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
                <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider mb-3">트림</p>
                <div className="flex flex-wrap gap-2">
                  {trimsInLineup.map((trim) => {
                    const hasSheet = activeSheets.some((s) => s.trimId === trim.id);
                    return (
                      <button
                        key={trim.id}
                        onClick={() => { setSelectedTrimId(trim.id); setShowHistory(false); }}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors relative ${
                          selectedTrimId === trim.id
                            ? "bg-[#6066EE] text-white border-[#6066EE]"
                            : "text-[#1A1A2E] border-[#E8EAF2] hover:border-[#6066EE]"
                        }`}
                      >
                        {trim.name}
                        {hasSheet && (
                          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 align-middle" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 입력 폼 or 이력 */}
            {selectedTrimId && selectedFc && selectedTrim ? (
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1A2E]">
                      {vehicleDetail.name} {selectedTrim.name}
                    </h2>
                    <p className="text-sm text-[#9BA4C0]">{selectedFc.name}</p>
                  </div>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-sm text-[#6066EE] hover:underline"
                  >
                    {showHistory ? "입력 폼으로" : "이력 보기"}
                  </button>
                </div>

                {showHistory ? (
                  <RateHistory
                    sheets={historySheets}
                    onActivate={handleActivate}
                    onDelete={handleDelete}
                  />
                ) : (
                  <RateInputForm
                    financeCompanyId={selectedFcId}
                    trimId={selectedTrimId}
                    trimPrice={selectedTrim.price}
                    existingSheet={currentSheet}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#9BA4C0] text-sm">
                {loadingDetail ? "로딩 중..." : "트림을 선택해 주세요"}
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#9BA4C0] text-sm">
            좌측에서 차량을 선택해 주세요
          </div>
        )}
      </div>
    </div>
  );
}
