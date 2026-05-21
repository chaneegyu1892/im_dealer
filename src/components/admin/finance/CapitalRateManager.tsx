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

interface SessionSavedTrim {
  trimId: string;
  trimName: string;
  vehicleId: string;
  vehicleName: string;
  brand: string;
  savedAt: string;
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
  const [selectedTrimIds, setSelectedTrimIds] = useState<Set<string>>(new Set());
  const [trimSearch, setTrimSearch] = useState("");
  const [selectedProductType, setSelectedProductType] = useState<"장기렌트" | "리스">("장기렌트");
  const [activeSheets, setActiveSheets] = useState<CapitalRateSheet[]>([]);
  const [historySheets, setHistorySheets] = useState<CapitalRateSheet[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isWritingSession, setIsWritingSession] = useState(false);
  const [sessionSavedTrims, setSessionSavedTrims] = useState<SessionSavedTrim[]>([]);

  const selectedFc = financeCompanies.find((f) => f.id === selectedFcId);

  const sessionSavedTrimIds = useMemo(() => {
    return new Set(sessionSavedTrims.map((item) => item.trimId));
  }, [sessionSavedTrims]);

  const sessionSavedByVehicle = useMemo(() => {
    const map = new Map<string, SessionSavedTrim[]>();
    for (const item of sessionSavedTrims) {
      const list = map.get(item.vehicleId) ?? [];
      list.push(item);
      map.set(item.vehicleId, list);
    }
    return map;
  }, [sessionSavedTrims]);

  // 차량 선택 시 상세(라인업+트림) 로드
  useEffect(() => {
    if (!selectedVehicleId) {
      setVehicleDetail(null);
      setSelectedLineupId("");
      setSelectedTrimIds(new Set());
      setTrimSearch("");
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
        setSelectedTrimIds(new Set());
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedVehicleId]);

  // 라인업 변경 시 트림 초기화
  useEffect(() => { 
    setSelectedTrimIds(new Set()); 
    setTrimSearch("");
  }, [selectedLineupId]);

  // 키워드 검색: 공백 기준으로 쪼갠 각 토큰이 트림명(공백 제거)에 모두 포함되어야 매칭.
  // 공백 없이 붙여 쓴 경우 한글↔숫자 경계로 추가 분해하여 순서 무관 매칭.
  function matchesTrimSearch(trimName: string, query: string): boolean {
    if (!query.trim()) return true;
    const normName = trimName.toLowerCase().replace(/\s+/g, "");
    const spaceTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return spaceTokens.every((token) => {
      if (normName.includes(token)) return true;
      // 한글↔숫자 경계로 분해 후 각 조각이 normName에 존재하는지 확인
      const subTokens = token
        .split(/(?<=[가-힣])(?=[0-9])|(?<=[0-9])(?=[가-힣])/)
        .filter(Boolean);
      return subTokens.length > 1 && subTokens.every((sub) => normName.includes(sub));
    });
  }

  // 현재 라인업의 트림 목록 (검색 필터 적용)
  const trimsInLineup = useMemo<TrimBasic[]>(() => {
    if (!vehicleDetail) return [];
    let list = vehicleDetail.trims.filter((t) => t.lineupId === selectedLineupId);
    if (trimSearch) {
      list = list.filter((t) => matchesTrimSearch(t.name, trimSearch));
    }
    return list;
  }, [vehicleDetail, selectedLineupId, trimSearch]);

  const selectedTrims = useMemo(() => {
    if (!vehicleDetail) return [];
    return vehicleDetail.trims.filter(t => selectedTrimIds.has(t.id));
  }, [vehicleDetail, selectedTrimIds]);

  const toggleTrim = useCallback((id: string) => {
    if (isWritingSession && sessionSavedTrimIds.has(id)) return;
    setSelectedTrimIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setShowHistory(false);
  }, [isWritingSession, sessionSavedTrimIds]);

  const selectAllTrims = () => {
    setSelectedTrimIds(new Set(
      trimsInLineup
        .filter((t) => !isWritingSession || !sessionSavedTrimIds.has(t.id))
        .map((t) => t.id)
    ));
  };

  const deselectAllTrims = () => {
    setSelectedTrimIds(new Set());
  };

  // 활성 시트 로드 (캐피탈사 선택 시)
  useEffect(() => {
    if (!selectedFcId) return;
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}`)
      .then((r) => r.json())
      .then((res) => setActiveSheets(res.data ?? []))
      .catch(console.error);
  }, [selectedFcId]);

  // 이력 로드 (다중 선택 시에는 마지막 선택된 트림 기준 또는 첫 번째 기준 - 여기서는 편의상 첫 번째)
  useEffect(() => {
    const firstId = Array.from(selectedTrimIds)[0];
    if (!selectedFcId || !firstId || !showHistory) return;
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}&trimId=${firstId}&history=true`)
      .then((r) => r.json())
      .then((res) => setHistorySheets(res.data ?? []))
      .catch(console.error);
  }, [selectedFcId, selectedTrimIds, showHistory]);

  const currentSheet = useMemo(() => {
    const firstId = Array.from(selectedTrimIds)[0];
    return activeSheets.find((s) => s.trimId === firstId && s.productType === selectedProductType);
  }, [activeSheets, selectedTrimIds, selectedProductType]);

  const handleSaved = (savedTrimIds: string[] = []) => {
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}`)
      .then((r) => r.json())
      .then((res) => setActiveSheets(res.data ?? []));
    
    const firstId = Array.from(selectedTrimIds)[0];
    if (showHistory && firstId) {
      fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}&trimId=${firstId}&history=true`)
        .then((r) => r.json())
        .then((res) => setHistorySheets(res.data ?? []));
    }

    if (isWritingSession && vehicleDetail && savedTrimIds.length > 0) {
      const savedAt = new Date().toISOString();
      const trimById = new Map(vehicleDetail.trims.map((trim) => [trim.id, trim]));

      setSessionSavedTrims((prev) => {
        const prevIds = new Set(prev.map((item) => item.trimId));
        const nextItems = savedTrimIds
          .filter((trimId) => !prevIds.has(trimId))
          .map((trimId) => {
            const trim = trimById.get(trimId);
            return {
              trimId,
              trimName: trim?.name ?? "알 수 없는 트림",
              vehicleId: vehicleDetail.id,
              vehicleName: vehicleDetail.name,
              brand: vehicleDetail.brand,
              savedAt,
            };
          });

        return nextItems.length > 0 ? [...prev, ...nextItems] : prev;
      });
      setSelectedTrimIds(new Set());
      setShowHistory(false);
    }
  };

  const startWritingSession = () => {
    setSessionSavedTrims([]);
    setSelectedTrimIds(new Set());
    setShowHistory(false);
    setIsWritingSession(true);
  };

  const finishWritingSession = () => {
    setIsWritingSession(false);
    setSessionSavedTrims([]);
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
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:h-full overflow-y-auto md:overflow-hidden">
      {/* ── 좌측: 캐피탈사 + 차량/라인업/트림 선택 ── */}
      <div className="w-full md:w-72 md:flex-shrink-0 flex flex-col gap-4 md:overflow-y-auto">
        {/* 캐피탈사 선택 */}
        <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
          <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider mb-3">캐피탈사</p>
          <div className="flex flex-col gap-1">
            {financeCompanies.map((fc) => (
              <button
                key={fc.id}
                onClick={() => {
                  setSelectedFcId(fc.id);
                  finishWritingSession();
                }}
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
                      {brandVehicles.map((v) => {
                        const savedCount = sessionSavedByVehicle.get(v.id)?.length ?? 0;
                        return (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedVehicleId(v.id);
                            setShowHistory(false);
                          }}
                          className={`text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                            selectedVehicleId === v.id
                              ? "bg-[#6066EE] text-white font-medium"
                              : "text-[#1A1A2E] hover:bg-[#F8F9FC]"
                          }`}
                        >
                          <span className="truncate">{v.name}</span>
                          {isWritingSession && savedCount > 0 && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              selectedVehicleId === v.id ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                            }`}>
                              {savedCount}개 저장
                            </span>
                          )}
                        </button>
                        );
                      })}
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
        <div className="bg-white rounded-xl border border-[#E8EAF2] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-[#1A1A2E]">회수율 작성 관리</p>
            <p className="text-xs text-[#9BA4C0] mt-1">
              {isWritingSession
                ? `작성 중입니다. 저장 완료된 트림 ${sessionSavedTrims.length}개는 다시 선택되지 않습니다.`
                : "주간/월간 입력을 시작하면 저장한 차량과 트림을 임시로 표시합니다."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
              {(["장기렌트", "리스"] as const).map((pt) => (
                <button
                  key={pt}
                  onClick={() => setSelectedProductType(pt)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedProductType === pt ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
            {isWritingSession && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                저장 {sessionSavedTrims.length}개
              </span>
            )}
            <button
              type="button"
              onClick={isWritingSession ? finishWritingSession : startWritingSession}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                isWritingSession
                  ? "border border-[#E8EAF2] text-[#1A1A2E] hover:bg-[#F8F9FC]"
                  : "bg-[#000666] text-white hover:bg-[#000888]"
              }`}
            >
              {isWritingSession ? "작성 마무리" : "작성 시작"}
            </button>
            </div>
          </div>
        </div>

        {isWritingSession && sessionSavedTrims.length > 0 && (
          <div className="bg-emerald-50/60 rounded-xl border border-emerald-100 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-bold text-emerald-700">이번 작성에서 저장한 항목</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionSavedTrims.map((item) => (
                <span
                  key={item.trimId}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-[#1A1A2E]"
                  title={new Date(item.savedAt).toLocaleString("ko-KR")}
                >
                  {item.brand} {item.vehicleName} · {item.trimName}
                </span>
              ))}
            </div>
          </div>
        )}

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
            {selectedLineupId && (
              <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider">트림 선택 ({selectedTrimIds.size}개 선택됨)</p>
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <div className="relative">
                      <input
                        type="text"
                        value={trimSearch}
                        onChange={(e) => setTrimSearch(e.target.value)}
                        placeholder="트림명 검색..."
                        className="pl-8 pr-3 py-1.5 border border-[#E8EAF2] rounded-lg text-xs focus:outline-none focus:border-[#6066EE] w-36 sm:w-48"
                      />
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9BA4C0]" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <button onClick={selectAllTrims} className="text-[11px] text-[#6066EE] hover:underline font-medium">전체 선택</button>
                    <button onClick={deselectAllTrims} className="text-[11px] text-[#9BA4C0] hover:underline font-medium">선택 해제</button>
                  </div>
                </div>
                
                {trimsInLineup.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {trimsInLineup.map((trim) => {
                      const isSelected = selectedTrimIds.has(trim.id);
                      const hasSheet = activeSheets.some((s) => s.trimId === trim.id);
                      const isSessionSaved = isWritingSession && sessionSavedTrimIds.has(trim.id);
                      return (
                        <button
                          key={trim.id}
                          onClick={() => toggleTrim(trim.id)}
                          disabled={isSessionSaved}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors relative flex items-center gap-2 ${
                            isSessionSaved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed"
                              :
                            isSelected
                              ? "bg-[#6066EE] text-white border-[#6066EE] shadow-sm"
                              : "text-[#1A1A2E] border-[#E8EAF2] hover:border-[#6066EE] bg-white"
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? "bg-white border-white" : isSessionSaved ? "bg-emerald-500 border-emerald-500" : "border-[#D1D5DB]"
                          }`}>
                            {isSelected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6066EE" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            {isSessionSaved && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span>{trim.name}</span>
                          {isSessionSaved && (
                            <span className="text-[10px] font-bold text-emerald-600">저장됨</span>
                          )}
                          {hasSheet && (
                            <span className={`inline-block w-1.5 h-1.5 rounded-full align-middle ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-[#9BA4C0] text-sm">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            )}

            {/* 입력 폼 or 이력 */}
            {selectedTrimIds.size > 0 && selectedFc ? (
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
                      {selectedTrimIds.size === 1 ? (
                        <>
                          {vehicleDetail.name} {selectedTrims[0]?.name}
                        </>
                      ) : (
                        <>
                          {vehicleDetail.name} <span className="text-[#6066EE]">{selectedTrimIds.size}개 트림 선택됨</span>
                        </>
                      )}
                    </h2>
                    <p className="text-sm text-[#9BA4C0]">{selectedFc.name}</p>
                  </div>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-sm text-[#6066EE] hover:underline"
                  >
                    {showHistory ? "입력 폼으로" : (selectedTrimIds.size === 1 ? "이력 보기" : "")}
                  </button>
                </div>

                {showHistory && selectedTrimIds.size === 1 ? (
                  <RateHistory
                    sheets={historySheets}
                    onActivate={handleActivate}
                    onDelete={handleDelete}
                  />
                ) : (
                  <RateInputForm
                    financeCompanyId={selectedFcId}
                    trimIds={Array.from(selectedTrimIds)}
                    trimPrice={selectedTrims[0]?.price ?? 0}
                    productType={selectedProductType}
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
