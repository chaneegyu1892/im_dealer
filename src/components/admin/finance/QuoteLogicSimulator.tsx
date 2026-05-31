"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, TrendingUp, Search } from "lucide-react";
import { calculateMultiFinanceQuote, type RateConfigData, type CalcInput } from "@/lib/quote-calculator";
import type { FinanceQuoteResult } from "@/types/quote";
import { useBrandSignals } from "@/lib/use-brand-signals";
import { extractDrivetrain, lineupDisplayLabel } from "@/lib/drivetrain";

type ProductType = "장기렌트" | "리스";
type RegistrationFilter = "all" | "registered" | "unregistered";

interface SummarySheet {
  sheetId: string;
  financeCompanyId: string;
  financeCompanyName: string;
  productType: string;
  weekOf: string;
  trimId: string;
  trimName: string;
  lineupId: string | null;
  lineupName: string | null;
  vehicleId: string;
  vehicleName: string;
  brand: string;
}

export default function QuoteLogicSimulator() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [summary, setSummary] = useState<SummarySheet[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  // 라인업 + 구동방식 복합키 (`${lineupId}|${drivetrain ?? ""}`).
  // 일반 차량은 한 라인업에 2WD/4WD 트림이 섞여 있어 구동방식별로 칩을 분리한다.
  const [selectedKey, setSelectedKey] = useState<string>("");

  const [productType, setProductType] = useState<ProductType>("장기렌트");
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [months, setMonths] = useState(48);
  const [mileage, setMileage] = useState(20000);
  const [depositRate, setDepositRate] = useState(0);
  const [prepayRate, setPrepayRate] = useState(0);
  const [results, setResults] = useState<FinanceQuoteResult[]>([]);
  const [rankRates, setRankRates] = useState<number[]>([1, 1.5, 2, 2.5]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string>("");
  const { comparator: brandComparator } = useBrandSignals();

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [vRes, pRes, sRes] = await Promise.all([
          fetch("/api/admin/vehicles?includeTrims=true"),
          fetch("/api/admin/settings/policy"),
          fetch("/api/admin/capital-rates/summary"),
        ]);
        const vData = await vRes.json();
        const pData = await pRes.json();
        const sData = await sRes.json();

        if (vData.success) setVehicles(vData.data);
        if (pData.success) {
          const rates = pData.data.sort((a: any, b: any) => a.rank - b.rank).map((r: any) => r.rate);
          if (rates.length > 0) setRankRates(rates);
        }
        if (sData.success) setSummary(sData.data);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 차량별 등록 상태 (선택된 productType 기준)
  const vehicleRegistrationStatus = useMemo(() => {
    const map = new Map<string, { lineupIds: Set<string>; financeCompanyIds: Set<string> }>();
    for (const s of summary) {
      if (s.productType !== productType) continue;
      const entry = map.get(s.vehicleId) ?? { lineupIds: new Set(), financeCompanyIds: new Set() };
      if (s.lineupId) entry.lineupIds.add(s.lineupId);
      entry.financeCompanyIds.add(s.financeCompanyId);
      map.set(s.vehicleId, entry);
    }
    return map;
  }, [summary, productType]);

  // 라인업별 등록 상태 (선택된 productType 기준)
  const lineupRegistrationStatus = useMemo(() => {
    const map = new Map<string, { financeCompanies: Map<string, { name: string; weekOf: string; productType: string }> }>();
    for (const s of summary) {
      if (!s.lineupId) continue;
      const entry = map.get(s.lineupId) ?? { financeCompanies: new Map() };
      const key = `${s.financeCompanyId}|${s.productType}`;
      const existing = entry.financeCompanies.get(key);
      if (!existing || new Date(s.weekOf) > new Date(existing.weekOf)) {
        entry.financeCompanies.set(key, {
          name: s.financeCompanyName,
          weekOf: s.weekOf,
          productType: s.productType,
        });
      }
      map.set(s.lineupId, entry);
    }
    return map;
  }, [summary]);

  // 필터링된 차량 목록 (검색어 + 등록 상태 + 브랜드)
  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vehicles.filter((v) => {
      // 검색어 필터
      if (q && !v.name.toLowerCase().includes(q) && !v.brand.toLowerCase().includes(q)) {
        return false;
      }
      // 등록 상태 필터
      if (registrationFilter === "all") return true;
      const isRegistered = vehicleRegistrationStatus.has(v.id);
      return registrationFilter === "registered" ? isRegistered : !isRegistered;
    });
  }, [vehicles, searchQuery, registrationFilter, vehicleRegistrationStatus]);

  // 차량 → 브랜드별 그룹 (SSOT 정렬: isFeatured → 차량 수 → 가나다)
  const groupedVehicles = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const v of filteredVehicles) {
      const list = map.get(v.brand) ?? [];
      list.push(v);
      map.set(v.brand, list);
    }
    return new Map(Array.from(map.entries()).sort(([a], [b]) => brandComparator(a, b)));
  }, [filteredVehicles, brandComparator]);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;

  // 선택된 차량의 라인업 목록 (구동방식별로 분리 — HEV처럼 2WD/4WD 표기)
  const lineupsOfSelected = useMemo(() => {
    type LineupEntry = { key: string; lineupId: string; drivetrain: string | null; name: string; trims: any[] };
    if (!selectedVehicle) return [] as LineupEntry[];
    const grouped = new Map<string, LineupEntry>();
    for (const t of selectedVehicle.trims ?? []) {
      if (!t.lineupId) continue;
      const lineupName = (selectedVehicle.lineups ?? []).find((l: any) => l.id === t.lineupId)?.name ?? t.lineupName ?? "";
      // 라인업 이름에 구동방식이 있으면(HEV) 라인업 단위로, 없으면 트림 이름에서 추출해 분리.
      const drivetrain = extractDrivetrain(lineupName) ?? extractDrivetrain(t.name);
      const key = `${t.lineupId}|${drivetrain ?? ""}`;
      const existing = grouped.get(key);
      const entry: LineupEntry =
        existing ?? { key, lineupId: t.lineupId, drivetrain, name: lineupDisplayLabel(lineupName, t.name), trims: [] };
      entry.trims.push(t);
      grouped.set(key, entry);
    }
    return Array.from(grouped.values());
  }, [selectedVehicle]);

  // 차량 선택 시 첫 라인업 자동 선택
  useEffect(() => {
    if (!selectedVehicleId) {
      setSelectedKey("");
      return;
    }
    if (lineupsOfSelected.length > 0 && !lineupsOfSelected.some((l) => l.key === selectedKey)) {
      setSelectedKey(lineupsOfSelected[0].key);
    }
    setResults([]);
    setCalcError("");
  }, [selectedVehicleId, lineupsOfSelected, selectedKey]);

  const selectedLineup = lineupsOfSelected.find((l) => l.key === selectedKey) ?? null;

  // 선택된 라인업의 등록 매트릭스 — 캐피탈사 × 리스/렌트 × 업데이트 일자
  // (매트릭스는 라인업 단위 데이터이므로 같은 라인업의 2WD/4WD 칩은 동일 매트릭스를 공유)
  const selectedLineupMatrix = useMemo(() => {
    if (!selectedLineup) return null;
    const entry = lineupRegistrationStatus.get(selectedLineup.lineupId);
    if (!entry) return [];
    const byCompany = new Map<string, { financeCompanyName: string; 장기렌트: string | null; 리스: string | null }>();
    for (const [, v] of entry.financeCompanies) {
      const row = byCompany.get(v.name) ?? { financeCompanyName: v.name, 장기렌트: null, 리스: null };
      if (v.productType === "장기렌트") row.장기렌트 = v.weekOf;
      if (v.productType === "리스") row.리스 = v.weekOf;
      byCompany.set(v.name, row);
    }
    return Array.from(byCompany.values()).sort((a, b) => a.financeCompanyName.localeCompare(b.financeCompanyName, "ko"));
  }, [selectedLineup, lineupRegistrationStatus]);

  // 라인업 대표 가격 (할인가 우선, 라인업 내 최소 트림 기준)
  const lineupBasePrice = useMemo(() => {
    if (!selectedLineup || selectedLineup.trims.length === 0) return 0;
    const prices = selectedLineup.trims.map((t: any) => t.discountPrice ?? t.price);
    return Math.min(...prices);
  }, [selectedLineup]);

  const handleCalculate = async () => {
    setCalcError("");
    setResults([]);
    if (!selectedVehicle || !selectedLineup) return;

    const lineup = selectedLineup;
    if (lineup.trims.length === 0) {
      setCalcError("선택된 라인업에 트림이 없습니다.");
      return;
    }

    setCalculating(true);
    try {
      // 구동방식 서브그룹의 대표 트림(첫 트림) 기준으로 회수율 조회 — 라인업 내 모든 트림이 동일 시트
      const repTrimId = lineup.trims[0].id;
      const res = await fetch(`/api/admin/capital-rates?trimId=${repTrimId}&productType=${productType}`);
      const data = await res.json();
      if (!data.success || data.data.length === 0) {
        setCalcError(
          `이 라인업(${productType})에 대한 회수율 데이터가 등록되어 있지 않습니다. 회수율 데이터 관리 탭에서 먼저 등록해 주세요.`
        );
        return;
      }

      // 캐피탈사별 최신 시트만 사용 (weekOf desc 정렬이므로 첫 번째가 최신)
      const seen = new Set<string>();
      const uniqueSheets = data.data.filter((rs: any) => {
        if (seen.has(rs.financeCompanyId)) return false;
        seen.add(rs.financeCompanyId);
        return true;
      });

      const configs: RateConfigData[] = uniqueSheets.map((rs: any) => ({
        financeCompanyId: rs.financeCompanyId,
        financeCompanyName: rs.financeCompany.name,
        financeSurchargeRate: rs.financeCompany.surchargeRate,
        minVehiclePrice: rs.minVehiclePrice,
        maxVehiclePrice: rs.maxVehiclePrice,
        minRateMatrix: rs.minRateMatrix,
        maxRateMatrix: rs.maxRateMatrix,
        depositDiscountRate: rs.depositDiscountRate,
        prepayAdjustRate: rs.prepayAdjustRate,
      }));

      const input: CalcInput = {
        vehiclePrice: lineupBasePrice,
        contractMonths: months,
        annualMileage: mileage,
        depositRate,
        prepayRate,
        vehicleSurchargeRate: selectedVehicle.surchargeRate || 0,
        rankSurchargeRates: rankRates,
        rateConfigs: configs,
      };

      const out = calculateMultiFinanceQuote(input);
      setResults(out);
    } finally {
      setCalculating(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#6066EE]" /></div>;

  const totalVehicles = vehicles.length;
  const registeredCount = vehicleRegistrationStatus.size;
  const unregisteredCount = totalVehicles - registeredCount;

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:h-[calc(100vh-260px)]">
      {/* ── 좌측: 필터 + 차량 리스트 ── */}
      <div className="w-full md:w-80 md:flex-shrink-0 flex flex-col gap-3 md:overflow-hidden">
        {/* 상품 유형 토글 */}
        <div className="bg-white rounded-xl border border-[#E8EAF0] p-3">
          <p className="text-[11px] font-bold text-[#9BA4C0] ml-1 mb-1.5">상품 유형</p>
          <div className="flex bg-[#F8F9FC] p-1 rounded-lg border border-[#E8EAF0]">
            {(["장기렌트", "리스"] as const).map((pt) => (
              <button
                key={pt}
                onClick={() => { setProductType(pt); setResults([]); setCalcError(""); }}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${productType === pt ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"}`}
              >
                {pt}
              </button>
            ))}
          </div>
        </div>

        {/* 등록 상태 토글 */}
        <div className="bg-white rounded-xl border border-[#E8EAF0] p-3">
          <p className="text-[11px] font-bold text-[#9BA4C0] ml-1 mb-1.5">등록 상태 ({productType})</p>
          <div className="flex bg-[#F8F9FC] p-1 rounded-lg border border-[#E8EAF0]">
            {([
              { id: "all" as const, label: "전체", count: totalVehicles },
              { id: "registered" as const, label: "등록", count: registeredCount },
              { id: "unregistered" as const, label: "미등록", count: unregisteredCount },
            ]).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setRegistrationFilter(opt.id)}
                className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                  registrationFilter === opt.id ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"
                }`}
              >
                {opt.label}
                <span className="ml-1 text-[10px] text-[#B0B8D0]">{opt.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 검색 */}
        <div className="bg-white rounded-xl border border-[#E8EAF0] p-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제조사·모델명으로 검색"
              className="w-full pl-9 pr-3 py-2 bg-[#F8F9FC] border border-[#E8EAF0] rounded-lg text-xs focus:outline-none focus:border-[#6066EE]"
            />
          </div>
        </div>

        {/* 차량 리스트 */}
        <div className="bg-white rounded-xl border border-[#E8EAF0] p-3 flex-1 overflow-y-auto">
          {filteredVehicles.length === 0 ? (
            <p className="text-center text-xs text-[#9BA4C0] py-8">조건에 맞는 차량이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {Array.from(groupedVehicles.entries()).map(([brand, brandVehicles]) => (
                <div key={brand}>
                  <p className="text-[10px] font-bold text-[#9BA4C0] uppercase tracking-wider mb-1.5 px-1">{brand}</p>
                  <div className="flex flex-col gap-0.5">
                    {brandVehicles.map((v) => {
                      const isSelected = selectedVehicleId === v.id;
                      const status = vehicleRegistrationStatus.get(v.id);
                      const isRegistered = !!status;
                      const fcCount = status?.financeCompanyIds.size ?? 0;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVehicleId(v.id)}
                          className={`text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                            isSelected
                              ? "bg-[#6066EE] text-white font-medium"
                              : "text-[#1A1A2E] hover:bg-[#F8F9FC]"
                          }`}
                        >
                          <span className="truncate">{v.name}</span>
                          {isRegistered ? (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                            }`}>
                              {fcCount}개사
                            </span>
                          ) : (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isSelected ? "bg-white/20 text-white/80" : "bg-red-50 text-red-500"
                            }`}>
                              미등록
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 우측: 라인업 + 등록 매트릭스 + 시뮬레이션 ── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto">
        {!selectedVehicle ? (
          <div className="flex-1 flex items-center justify-center bg-white rounded-2xl border border-[#E8EAF0] p-12 text-[#9BA4C0] text-sm">
            좌측에서 차량을 선택해 주세요
          </div>
        ) : (
          <>
            {/* 라인업 선택 */}
            <div className="bg-white rounded-2xl border border-[#E8EAF0] p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-[#1A1A2E]">
                  {selectedVehicle.brand} {selectedVehicle.name}
                </h2>
                <span className="text-[11px] text-[#9BA4C0]">라인업 {lineupsOfSelected.length}개</span>
              </div>
              {lineupsOfSelected.length === 0 ? (
                <p className="text-xs text-[#9BA4C0] py-2">이 차량에는 라인업이 등록되어 있지 않습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lineupsOfSelected.map((lineup) => {
                    const isSelected = selectedKey === lineup.key;
                    const lineupStatus = lineupRegistrationStatus.get(lineup.lineupId);
                    const hasReg = !!lineupStatus && Array.from(lineupStatus.financeCompanies.values()).some((v) => v.productType === productType);
                    return (
                      <button
                        key={lineup.key}
                        onClick={() => setSelectedKey(lineup.key)}
                        className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-2 ${
                          isSelected
                            ? "bg-[#000666] text-white border-[#000666]"
                            : "text-[#1A1A2E] border-[#E8EAF2] hover:border-[#6066EE]"
                        }`}
                      >
                        <span>{lineup.name}</span>
                        <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-[#9BA4C0]"}`}>
                          트림 {lineup.trims.length}개
                        </span>
                        {hasReg && (
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-400"}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 등록 캐피탈사 매트릭스 */}
            {selectedLineup && (
              <div className="bg-white rounded-2xl border border-[#E8EAF0] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#1A1A2E]">등록 캐피탈사 매트릭스</h3>
                  <span className="text-[11px] text-[#9BA4C0]">
                    {selectedLineupMatrix && selectedLineupMatrix.length > 0
                      ? `${selectedLineupMatrix.length}개 캐피탈사 등록됨`
                      : "미등록"}
                  </span>
                </div>
                {selectedLineupMatrix && selectedLineupMatrix.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#E8EAF0] text-[#9BA4C0]">
                          <th className="py-2 px-3 text-left font-semibold">캐피탈사</th>
                          <th className="py-2 px-3 text-center font-semibold">장기렌트</th>
                          <th className="py-2 px-3 text-center font-semibold">리스</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F1FA]">
                        {selectedLineupMatrix.map((row) => (
                          <tr key={row.financeCompanyName}>
                            <td className="py-2 px-3 font-medium text-[#1A1A2E]">{row.financeCompanyName}</td>
                            <td className="py-2 px-3 text-center">
                              {row.장기렌트 ? (
                                <span className="inline-flex flex-col items-center">
                                  <span className="text-emerald-600 font-semibold">✓</span>
                                  <span className="text-[10px] text-[#9BA4C0]">{row.장기렌트.slice(0, 10)}</span>
                                </span>
                              ) : (
                                <span className="text-[#D1D5DB]">—</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.리스 ? (
                                <span className="inline-flex flex-col items-center">
                                  <span className="text-emerald-600 font-semibold">✓</span>
                                  <span className="text-[10px] text-[#9BA4C0]">{row.리스.slice(0, 10)}</span>
                                </span>
                              ) : (
                                <span className="text-[#D1D5DB]">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-[#9BA4C0]">
                    이 라인업은 아직 회수율이 등록되지 않았습니다. 회수율 데이터 관리 탭에서 등록해 주세요.
                  </div>
                )}
              </div>
            )}

            {/* 시뮬레이션 조건 */}
            <div className="bg-white rounded-2xl border border-[#E8EAF0] p-4">
              <h3 className="text-sm font-bold text-[#1A1A2E] mb-3">시뮬레이션 조건</h3>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">사용 조건</label>
                  <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
                    {[36, 48, 60].map((m) => (
                      <button key={m} onClick={() => setMonths(m)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${months === m ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"}`}>
                        {m}개월
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">주행 거리</label>
                  <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
                    {[10000, 20000, 30000].map((m) => (
                      <button key={m} onClick={() => setMileage(m)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${mileage === m ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"}`}>
                        {m / 10000}만
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">보증금</label>
                  <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
                    {[0, 10, 20, 30].map((r) => (
                      <button key={r} onClick={() => { setDepositRate(r); if (r > 0) setPrepayRate(0); }} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${depositRate === r ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"}`}>
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">선납금</label>
                  <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
                    {[0, 10, 20, 30].map((r) => (
                      <button key={r} onClick={() => { setPrepayRate(r); if (r > 0) setDepositRate(0); }} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${prepayRate === r ? "bg-white shadow-sm text-[#6066EE]" : "text-[#9BA4C0]"}`}>
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCalculate}
                  disabled={!selectedLineup || calculating}
                  className="ml-auto px-6 py-2 bg-[#000666] text-white rounded-xl text-xs font-bold hover:bg-[#000888] transition-all disabled:opacity-50"
                >
                  {calculating ? "계산 중..." : "시뮬레이션 실행"}
                </button>
              </div>
              {calcError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {calcError}
                </div>
              )}
            </div>

            {/* 시뮬레이션 결과 테이블 */}
            {results.length > 0 && (
              <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-2 flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#6066EE]" />
                    단계별 가산 로직 분해
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${productType === "리스" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                      {productType}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#9BA4C0]">
                    기준 차량가 {(lineupBasePrice / 10000).toLocaleString()}만원 · 최종 고객 표출 가격 기준 정렬
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-[#E8EAF0] overflow-x-auto shadow-md shadow-indigo-50/30">
                  <table className="w-full min-w-[580px] text-xs">
                    <thead>
                      <tr className="bg-[#F8F9FC] border-b border-[#E8EAF0] text-[#9BA4C0] text-[11px] uppercase">
                        <th className="px-3 md:px-6 py-3 text-left font-bold">금융사</th>
                        <th className="px-3 md:px-6 py-3 text-center font-bold bg-blue-50/30">기본 로직 (0%)</th>
                        <th className="px-3 md:px-6 py-3 text-center font-bold">순위 가산</th>
                        <th className="px-3 md:px-6 py-3 text-center font-bold">차량 가산</th>
                        <th className="px-3 md:px-6 py-3 text-center font-bold">금융사 가산</th>
                        <th className="px-3 md:px-6 py-3 text-right font-bold bg-[#6066EE]/5 text-[#6066EE]">고객 표출 최종</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F1FA]">
                      {results.map((r, i) => {
                        const basePrice = r.breakdown.monthlyBeforeSurcharge;
                        const afterRank = basePrice + r.surcharges.rankSurcharge;
                        const afterVehicle = afterRank + r.surcharges.vehicleSurcharge;

                        return (
                          <tr key={r.financeCompanyId} className="group hover:bg-[#F8F9FC] transition-colors">
                            <td className="px-3 md:px-6 py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-[#1A1A2E] text-white text-[10px] flex items-center justify-center font-black shrink-0">{i + 1}</span>
                                <span className="font-bold text-[#1A1A2E] whitespace-nowrap">{r.financeCompanyName}</span>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 bg-blue-50/10">
                              <p className="text-center font-mono font-medium text-[#5A6080] whitespace-nowrap">{Math.round(basePrice).toLocaleString()}원</p>
                            </td>
                            <td className="px-3 md:px-6 py-3">
                              <div className="flex flex-col items-center">
                                <p className="text-[10px] text-red-400 font-bold whitespace-nowrap">+{r.surcharges.rankSurcharge.toLocaleString()}</p>
                                <p className="font-mono text-xs whitespace-nowrap">{afterRank.toLocaleString()}원</p>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3">
                              <div className="flex flex-col items-center">
                                <p className="text-[10px] text-orange-400 font-bold whitespace-nowrap">+{r.surcharges.vehicleSurcharge.toLocaleString()}</p>
                                <p className="font-mono text-xs whitespace-nowrap">{afterVehicle.toLocaleString()}원</p>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3">
                              <div className="flex flex-col items-center">
                                <p className={`text-[10px] font-bold whitespace-nowrap ${r.surcharges.financeSurcharge >= 0 ? "text-red-400" : "text-emerald-500"}`}>
                                  {r.surcharges.financeSurcharge > 0 ? "+" : ""}
                                  {r.surcharges.financeSurcharge.toLocaleString()}
                                </p>
                                <p className="font-mono text-xs whitespace-nowrap">{r.monthlyPayment.toLocaleString()}원</p>
                              </div>
                            </td>
                            <td className="px-3 md:px-6 py-3 bg-[#6066EE]/5 text-right">
                              <p className="text-base md:text-lg font-black text-[#6066EE] tracking-tighter whitespace-nowrap">{r.monthlyPayment.toLocaleString()}원</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
