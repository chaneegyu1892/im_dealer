"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type {
  AdminFinanceCompany,
  AdminVehicle,
  CapitalRateSheet,
} from "@/types/admin";
import RateInputForm from "./RateInputForm";
import RateHistory from "./RateHistory";
import { compareBrandNames } from "@/lib/brand-sort";

interface VehicleLineup {
  id: string;
  name: string;
}

interface TrimBasic {
  id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  lineupId: string | null;
}

interface VehicleWithLineups {
  id: string;
  name: string;
  brand: string;
  lineups: VehicleLineup[];
  trims: TrimBasic[];
}

interface SessionSavedLineup {
  lineupId: string;
  lineupName: string;
  vehicleId: string;
  vehicleName: string;
  brand: string;
  trimCount: number;
  savedAt: string;
}

interface Props {
  financeCompanies: AdminFinanceCompany[];
  vehicles: AdminVehicle[];
}

interface FinanceCompanyFormState {
  name: string;
  code: string;
  surchargeRate: string;
  isActive: boolean;
}

const emptyFinanceCompanyForm: FinanceCompanyFormState = {
  name: "",
  code: "",
  surchargeRate: "0",
  isActive: true,
};

export default function CapitalRateManager({ financeCompanies, vehicles }: Props) {
  const [localFinanceCompanies, setLocalFinanceCompanies] = useState<AdminFinanceCompany[]>(financeCompanies);
  const [selectedFcId, setSelectedFcId] = useState<string>(financeCompanies[0]?.id ?? "");
  const [companyForm, setCompanyForm] = useState<FinanceCompanyFormState>(emptyFinanceCompanyForm);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const vehiclesByBrand = useMemo(() => {
    const map = new Map<string, AdminVehicle[]>();
    for (const v of vehicles) {
      const list = map.get(v.brand) ?? [];
      list.push(v);
      map.set(v.brand, list);
    }
    // 어드민 일관 정렬: 현대/기아/제네시스/BMW/벤츠 우선, 그 외 가나다순
    return new Map(Array.from(map.entries()).sort(([a], [b]) => compareBrandNames(a, b)));
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
  const [selectedLineupIds, setSelectedLineupIds] = useState<Set<string>>(new Set());
  const [selectedProductType, setSelectedProductType] = useState<"장기렌트" | "리스">("장기렌트");
  const [activeSheets, setActiveSheets] = useState<CapitalRateSheet[]>([]);
  const [historySheets, setHistorySheets] = useState<CapitalRateSheet[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isWritingSession, setIsWritingSession] = useState(false);
  const [sessionSavedLineups, setSessionSavedLineups] = useState<SessionSavedLineup[]>([]);

  const selectedFc = localFinanceCompanies.find((f) => f.id === selectedFcId);

  useEffect(() => {
    setLocalFinanceCompanies(financeCompanies);
  }, [financeCompanies]);

  useEffect(() => {
    if (selectedFcId || localFinanceCompanies.length === 0) return;
    setSelectedFcId(localFinanceCompanies[0].id);
  }, [localFinanceCompanies, selectedFcId]);

  const sessionSavedLineupIds = useMemo(() => {
    return new Set(sessionSavedLineups.map((item) => item.lineupId));
  }, [sessionSavedLineups]);

  const sessionSavedByVehicle = useMemo(() => {
    const map = new Map<string, SessionSavedLineup[]>();
    for (const item of sessionSavedLineups) {
      const list = map.get(item.vehicleId) ?? [];
      list.push(item);
      map.set(item.vehicleId, list);
    }
    return map;
  }, [sessionSavedLineups]);

  // 차량 선택 시 상세(라인업+트림) 로드
  useEffect(() => {
    if (!selectedVehicleId) {
      setVehicleDetail(null);
      setSelectedLineupIds(new Set());
      return;
    }
    setLoadingDetail(true);
    fetch(`/api/admin/vehicles/${selectedVehicleId}`)
      .then((r) => r.json())
      .then((res) => {
        const vehicle = res.data ?? res; // { success, data } 또는 직접 vehicle
        setVehicleDetail(vehicle);
        setSelectedLineupIds(new Set());
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedVehicleId]);

  // 선택된 라인업들에 속한 모든 트림 ID 자동 도출 (B안: 라인업 단위 입력 → 백엔드는 트림 단위 저장)
  const derivedTrimIds = useMemo<string[]>(() => {
    if (!vehicleDetail) return [];
    return vehicleDetail.trims
      .filter((t) => t.lineupId && selectedLineupIds.has(t.lineupId))
      .map((t) => t.id);
  }, [vehicleDetail, selectedLineupIds]);

  // 선택된 라인업 내 트림 가격 기준 자동 MIN/MAX (A안: 여유분 없이 정확한 값. discountPrice 우선)
  const autoPriceRange = useMemo(() => {
    if (!vehicleDetail) return null;
    const trims = vehicleDetail.trims.filter(
      (t) => t.lineupId && selectedLineupIds.has(t.lineupId)
    );
    if (trims.length === 0) return null;
    const prices = trims.map((t) => t.discountPrice ?? t.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [vehicleDetail, selectedLineupIds]);

  const toggleLineup = useCallback(
    (id: string) => {
      if (isWritingSession && sessionSavedLineupIds.has(id)) return;
      setSelectedLineupIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setShowHistory(false);
    },
    [isWritingSession, sessionSavedLineupIds]
  );

  const selectAllLineups = () => {
    if (!vehicleDetail) return;
    setSelectedLineupIds(
      new Set(
        vehicleDetail.lineups
          .filter((l) => !isWritingSession || !sessionSavedLineupIds.has(l.id))
          .map((l) => l.id)
      )
    );
  };

  const deselectAllLineups = () => {
    setSelectedLineupIds(new Set());
  };

  // 활성 시트 로드 (캐피탈사 선택 시)
  useEffect(() => {
    if (!selectedFcId) return;
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}`)
      .then((r) => r.json())
      .then((res) => setActiveSheets(res.data ?? []))
      .catch(console.error);
  }, [selectedFcId]);

  // 이력 로드 — 1개 라인업만 선택된 경우, 그 라인업의 대표 트림(첫 트림) 기준으로 조회
  const firstDerivedTrimId = derivedTrimIds[0];
  useEffect(() => {
    if (!selectedFcId || !firstDerivedTrimId || !showHistory) return;
    if (selectedLineupIds.size !== 1) return;
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}&trimId=${firstDerivedTrimId}&history=true`)
      .then((r) => r.json())
      .then((res) => setHistorySheets(res.data ?? []))
      .catch(console.error);
  }, [selectedFcId, firstDerivedTrimId, showHistory, selectedLineupIds]);

  // 현재 라인업 대표 시트 — 라인업 내 첫 트림의 시트 (B안: 모든 트림이 동일값이라는 전제)
  const currentSheet = useMemo(() => {
    if (!firstDerivedTrimId) return undefined;
    return activeSheets.find(
      (s) => s.trimId === firstDerivedTrimId && s.productType === selectedProductType
    );
  }, [activeSheets, firstDerivedTrimId, selectedProductType]);

  // 라인업 내 트림들의 시트값이 서로 다른 경우 안내용 플래그
  const hasMixedSheetsInLineup = useMemo(() => {
    if (selectedLineupIds.size !== 1 || derivedTrimIds.length <= 1) return false;
    const sheets = derivedTrimIds
      .map((tid) => activeSheets.find((s) => s.trimId === tid && s.productType === selectedProductType))
      .filter((s) => s !== undefined) as CapitalRateSheet[];
    if (sheets.length <= 1) return false;
    const first = sheets[0];
    return sheets.some(
      (s) =>
        s.minVehiclePrice !== first.minVehiclePrice ||
        s.maxVehiclePrice !== first.maxVehiclePrice ||
        JSON.stringify(s.minBaseRates) !== JSON.stringify(first.minBaseRates) ||
        JSON.stringify(s.maxBaseRates) !== JSON.stringify(first.maxBaseRates)
    );
  }, [selectedLineupIds, derivedTrimIds, activeSheets, selectedProductType]);

  const handleSaved = (savedTrimIds: string[] = []) => {
    fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}`)
      .then((r) => r.json())
      .then((res) => setActiveSheets(res.data ?? []));

    if (showHistory && firstDerivedTrimId && selectedLineupIds.size === 1) {
      fetch(`/api/admin/capital-rates?financeCompanyId=${selectedFcId}&trimId=${firstDerivedTrimId}&history=true`)
        .then((r) => r.json())
        .then((res) => setHistorySheets(res.data ?? []));
    }

    if (isWritingSession && vehicleDetail && savedTrimIds.length > 0) {
      const savedAt = new Date().toISOString();
      const lineupById = new Map(vehicleDetail.lineups.map((l) => [l.id, l]));

      setSessionSavedLineups((prev) => {
        const prevIds = new Set(prev.map((item) => item.lineupId));
        const nextItems = Array.from(selectedLineupIds)
          .filter((lid) => !prevIds.has(lid))
          .map((lid) => {
            const lineup = lineupById.get(lid);
            const trimCount = vehicleDetail.trims.filter((t) => t.lineupId === lid).length;
            return {
              lineupId: lid,
              lineupName: lineup?.name ?? "알 수 없는 라인업",
              vehicleId: vehicleDetail.id,
              vehicleName: vehicleDetail.name,
              brand: vehicleDetail.brand,
              trimCount,
              savedAt,
            };
          });

        return nextItems.length > 0 ? [...prev, ...nextItems] : prev;
      });
      setSelectedLineupIds(new Set());
      setShowHistory(false);
    }
  };

  const startWritingSession = () => {
    setSessionSavedLineups([]);
    setSelectedLineupIds(new Set());
    setShowHistory(false);
    setIsWritingSession(true);
  };

  const finishWritingSession = () => {
    setIsWritingSession(false);
    setSessionSavedLineups([]);
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

  const resetCompanyForm = () => {
    setEditingCompanyId(null);
    setCompanyForm(emptyFinanceCompanyForm);
    setCompanyError("");
  };

  const startCompanyEdit = (company: AdminFinanceCompany) => {
    setEditingCompanyId(company.id);
    setCompanyForm({
      name: company.name,
      code: company.code,
      surchargeRate: String(company.surchargeRate ?? 0),
      isActive: company.isActive,
    });
    setCompanyError("");
  };

  const saveFinanceCompany = async () => {
    const name = companyForm.name.trim();
    const code = companyForm.code.trim().toUpperCase();
    const surchargeRate = Number(companyForm.surchargeRate || 0);

    if (!name || !code) {
      setCompanyError("캐피탈사명과 코드를 입력해 주세요.");
      return;
    }
    if (!Number.isFinite(surchargeRate)) {
      setCompanyError("가산율은 숫자로 입력해 주세요.");
      return;
    }

    setSavingCompany(true);
    setCompanyError("");
    try {
      const res = await fetch(
        editingCompanyId ? `/api/admin/finance-companies/${editingCompanyId}` : "/api/admin/finance-companies",
        {
          method: editingCompanyId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, code, surchargeRate, isActive: companyForm.isActive }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCompanyError(data.error ?? "캐피탈사 저장에 실패했습니다.");
        return;
      }

      setLocalFinanceCompanies((prev) => {
        const next = editingCompanyId
          ? prev.map((fc) => (fc.id === data.data.id ? data.data : fc))
          : [...prev, data.data];
        return next.sort((a, b) => a.displayOrder - b.displayOrder);
      });
      setSelectedFcId(data.data.id);
      resetCompanyForm();
    } finally {
      setSavingCompany(false);
    }
  };

  const deleteFinanceCompany = async (company: AdminFinanceCompany) => {
    if (!confirm(`${company.name} 캐피탈사를 삭제하시겠습니까?\n연결된 회수율 데이터도 함께 삭제됩니다.`)) return;

    setSavingCompany(true);
    setCompanyError("");
    try {
      const res = await fetch(`/api/admin/finance-companies/${company.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCompanyError(data.error ?? "캐피탈사 삭제에 실패했습니다.");
        return;
      }

      const nextCompanies = localFinanceCompanies.filter((fc) => fc.id !== company.id);
      setLocalFinanceCompanies(nextCompanies);
      if (selectedFcId === company.id) setSelectedFcId(nextCompanies[0]?.id ?? "");
      if (editingCompanyId === company.id) resetCompanyForm();
    } finally {
      setSavingCompany(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:h-full overflow-y-auto md:overflow-hidden">
      {/* ── 좌측: 캐피탈사 + 차량 선택 ── */}
      <div className="w-full md:w-72 md:flex-shrink-0 flex flex-col gap-4 md:overflow-y-auto">
        {/* 캐피탈사 선택 및 관리 */}
        <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider">캐피탈사</p>
            {editingCompanyId && (
              <button
                type="button"
                onClick={resetCompanyForm}
                className="text-[11px] font-semibold text-[#9BA4C0] hover:text-[#6066EE]"
              >
                신규 입력
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {localFinanceCompanies.map((fc) => (
              <div
                key={fc.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                  selectedFcId === fc.id
                    ? "bg-[#000666] text-white"
                    : "text-[#1A1A2E] hover:bg-[#F0F1FA]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFcId(fc.id);
                    finishWritingSession();
                  }}
                  className="min-w-0 flex-1 text-left text-sm font-medium"
                >
                  <span className="block truncate">{fc.name}</span>
                </button>
                {!fc.isActive && (
                  <span className={`text-xs ${selectedFcId === fc.id ? "text-white/70" : "text-[#9BA4C0]"}`}>(비활성)</span>
                )}
                <button
                  type="button"
                  onClick={() => startCompanyEdit(fc)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    selectedFcId === fc.id ? "text-white/80 hover:bg-white/10" : "text-[#9BA4C0] hover:text-[#6066EE]"
                  }`}
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => deleteFinanceCompany(fc)}
                  disabled={savingCompany}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    selectedFcId === fc.id ? "text-white/80 hover:bg-white/10" : "text-[#9BA4C0] hover:text-red-500"
                  }`}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-[#F0F1FA] pt-4">
            <p className="text-[11px] font-bold text-[#6B7399]">
              {editingCompanyId ? "캐피탈사 수정" : "캐피탈사 추가"}
            </p>
            <input
              type="text"
              value={companyForm.name}
              onChange={(e) => setCompanyForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="캐피탈사명"
              className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-xs focus:border-[#6066EE] focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={companyForm.code}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="코드"
                className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-xs uppercase focus:border-[#6066EE] focus:outline-none"
              />
              <input
                type="number"
                step="0.1"
                value={companyForm.surchargeRate}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, surchargeRate: e.target.value }))}
                placeholder="가산율"
                className="w-full rounded-lg border border-[#E8EAF2] px-3 py-2 text-xs focus:border-[#6066EE] focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-[#6B7399]">
              <input
                type="checkbox"
                checked={companyForm.isActive}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                className="h-3.5 w-3.5 accent-[#6066EE]"
              />
              활성 상태
            </label>
            {companyError && <p className="text-[11px] font-medium text-red-500">{companyError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveFinanceCompany}
                disabled={savingCompany}
                className="flex-1 rounded-lg bg-[#000666] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {savingCompany ? "저장 중..." : editingCompanyId ? "수정 저장" : "추가"}
              </button>
              {editingCompanyId && (
                <button
                  type="button"
                  onClick={resetCompanyForm}
                  className="rounded-lg border border-[#E8EAF2] px-3 py-2 text-xs font-bold text-[#6B7399]"
                >
                  취소
                </button>
              )}
            </div>
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
                              라인업 {savedCount}개 저장
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

      {/* ── 우측: 라인업 멀티셀렉트 + 입력 폼 ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="bg-white rounded-xl border border-[#E8EAF2] p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-[#1A1A2E]">회수율 작성 관리</p>
            <p className="text-xs text-[#9BA4C0] mt-1">
              {isWritingSession
                ? `작성 중입니다. 저장 완료된 라인업 ${sessionSavedLineups.length}개는 다시 선택되지 않습니다.`
                : "주간/월간 입력을 시작하면 저장한 차량과 라인업을 임시로 표시합니다."}
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
                저장 {sessionSavedLineups.length}개
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

        {isWritingSession && sessionSavedLineups.length > 0 && (
          <div className="bg-emerald-50/60 rounded-xl border border-emerald-100 p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-xs font-bold text-emerald-700">이번 작성에서 저장한 항목</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sessionSavedLineups.map((item) => (
                <span
                  key={item.lineupId}
                  className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-[#1A1A2E]"
                  title={new Date(item.savedAt).toLocaleString("ko-KR")}
                >
                  {item.brand} {item.vehicleName} · {item.lineupName} ({item.trimCount}개 트림)
                </span>
              ))}
            </div>
          </div>
        )}

        {selectedVehicleId && vehicleDetail ? (
          <>
            {/* 라인업 멀티 체크박스 */}
            {vehicleDetail.lineups.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E8EAF2] p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-[#9BA4C0] uppercase tracking-wider">
                    라인업 선택 ({selectedLineupIds.size}개 / 트림 {derivedTrimIds.length}개 자동 적용)
                  </p>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={selectAllLineups} className="text-[11px] text-[#6066EE] hover:underline font-medium">전체 선택</button>
                    <button onClick={deselectAllLineups} className="text-[11px] text-[#9BA4C0] hover:underline font-medium">선택 해제</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {vehicleDetail.lineups.map((lineup) => {
                    const isSelected = selectedLineupIds.has(lineup.id);
                    const lineupTrims = vehicleDetail.trims.filter((t) => t.lineupId === lineup.id);
                    const trimCount = lineupTrims.length;
                    const hasSheet = lineupTrims.some((t) =>
                      activeSheets.some((s) => s.trimId === t.id && s.productType === selectedProductType)
                    );
                    const isSessionSaved = isWritingSession && sessionSavedLineupIds.has(lineup.id);
                    return (
                      <button
                        key={lineup.id}
                        onClick={() => toggleLineup(lineup.id)}
                        disabled={isSessionSaved}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors relative flex items-center gap-2 ${
                          isSessionSaved
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 cursor-not-allowed"
                            : isSelected
                            ? "bg-[#6066EE] text-white border-[#6066EE] shadow-sm"
                            : "text-[#1A1A2E] border-[#E8EAF2] hover:border-[#6066EE] bg-white"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? "bg-white border-white" : isSessionSaved ? "bg-emerald-500 border-emerald-500" : "border-[#D1D5DB]"
                          }`}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6066EE" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {isSessionSaved && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <span>{lineup.name}</span>
                        <span
                          className={`text-[10px] ${
                            isSelected ? "text-white/80" : isSessionSaved ? "text-emerald-500" : "text-[#9BA4C0]"
                          }`}
                        >
                          트림 {trimCount}개
                        </span>
                        {isSessionSaved && (
                          <span className="text-[10px] font-bold text-emerald-600">저장됨</span>
                        )}
                        {hasSheet && !isSelected && !isSessionSaved && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full align-middle bg-emerald-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 입력 폼 or 이력 */}
            {selectedLineupIds.size > 0 && selectedFc ? (
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
                      {selectedLineupIds.size === 1 ? (
                        <>
                          {vehicleDetail.name}{" "}
                          <span className="text-[#6066EE]">
                            {vehicleDetail.lineups.find((l) => l.id === Array.from(selectedLineupIds)[0])?.name}
                          </span>
                        </>
                      ) : (
                        <>
                          {vehicleDetail.name}{" "}
                          <span className="text-[#6066EE]">{selectedLineupIds.size}개 라인업 선택됨</span>
                        </>
                      )}
                    </h2>
                    <p className="text-sm text-[#9BA4C0]">
                      {selectedFc.name} · 적용 트림 {derivedTrimIds.length}개
                    </p>
                  </div>
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-sm text-[#6066EE] hover:underline"
                  >
                    {showHistory ? "입력 폼으로" : selectedLineupIds.size === 1 ? "이력 보기" : ""}
                  </button>
                </div>

                {hasMixedSheetsInLineup && !showHistory && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                    ⚠️ 이 라인업 내 트림들의 기존 시트값이 서로 다릅니다. 표시된 값은 대표 트림 기준이며, 저장 시 라인업 내 모든 트림에 동일하게 덮어쓰여집니다.
                  </div>
                )}

                {showHistory && selectedLineupIds.size === 1 ? (
                  <RateHistory
                    sheets={historySheets}
                    onActivate={handleActivate}
                    onDelete={handleDelete}
                  />
                ) : (
                  <RateInputForm
                    financeCompanyId={selectedFcId}
                    trimIds={derivedTrimIds}
                    initialMinPrice={autoPriceRange?.min ?? 0}
                    initialMaxPrice={autoPriceRange?.max ?? 0}
                    productType={selectedProductType}
                    existingSheet={currentSheet}
                    onSaved={handleSaved}
                  />
                )}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#9BA4C0] text-sm">
                {loadingDetail ? "로딩 중..." : "라인업을 선택해 주세요"}
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
