"use client";

import { useState, useEffect } from "react";
import { Landmark, CarFront, Percent, Search, Loader2 } from "lucide-react";
import PolicyManager from "../settings/PolicyManager";

interface FinanceCompanySurcharge {
  id: string;
  name: string;
  surchargeRate: number;
  isActive: boolean;
}

interface VehicleSurcharge {
  id: string;
  name: string;
  brand: string;
  surchargeRate: number;
  isVisible: boolean;
}

export default function SurchargePolicy() {
  const [fcs, setFcs] = useState<FinanceCompanySurcharge[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSurcharge[]>([]);
  const [vSearch, setVSearch] = useState("");
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // 금융사 목록 로드
  useEffect(() => {
    async function loadFcs() {
      try {
        const res = await fetch("/api/admin/finance-companies");
        const data = await res.json();
        if (data.success) setFcs(data.data);
      } catch {}
    }
    loadFcs();
  }, []);

  // 차량 목록 로드 (검색어 포함)
  useEffect(() => {
    async function loadVehicles() {
      setLoadingVehicles(true);
      try {
        const res = await fetch(`/api/admin/vehicles?search=${vSearch}`);
        const data = await res.json();
        if (data.success) setVehicles(data.data);
      } finally {
        setLoadingVehicles(false);
      }
    }
    const timer = setTimeout(loadVehicles, 300);
    return () => clearTimeout(timer);
  }, [vSearch]);

  const handleUpdateFcSurcharge = async (id: string, rate: number) => {
    setSavingId(id);
    try {
      await fetch(`/api/admin/finance-companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surchargeRate: rate }),
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleUpdateVehicleSurcharge = async (id: string, rate: number) => {
    setSavingId(id);
    try {
      await fetch(`/api/admin/vehicles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surchargeRate: rate }),
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-12 max-w-5xl">
      {/* 1. 기본 견적가 순위 가산 */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#F0F1FA] rounded-xl text-[#6066EE]">
            <Percent size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">01. 기본 견적가 순위 가산</h2>
            <p className="text-sm text-[#9BA4C0]">검색 결과 순위에 따른 기본 가산 정책을 설정합니다.</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#E8EAF0] shadow-sm">
          <PolicyManager />
        </div>
      </section>

      {/* 2. 차량별 가산율 관리 */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-500">
              <CarFront size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1A1A2E]">02. 차량별 가산 관리</h2>
              <p className="text-sm text-[#9BA4C0]">특정 브랜드 및 모델에 대한 고정 가산율을 설정합니다.</p>
            </div>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA4C0] group-focus-within:text-[#6066EE] transition-colors" size={16} />
            <input
              type="text"
              placeholder="차량명 검색..."
              value={vSearch}
              onChange={(e) => setVSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-[#E8EAF0] rounded-2xl text-sm focus:outline-none focus:border-[#6066EE] focus:ring-4 focus:ring-[#6066EE]/5 transition-all w-64"
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-[#E8EAF0] overflow-hidden shadow-sm">
          <div className="max-h-[400px] overflow-y-auto overflow-x-hidden thin-scrollbar">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#F8F9FC] border-b border-[#E8EAF0] text-[#9BA4C0] text-[11px] uppercase z-10">
                <tr>
                  <th className="px-6 py-4 text-left font-bold">브랜드 / 차량명</th>
                  <th className="px-6 py-4 text-center w-36 font-bold">가산율 (%)</th>
                  <th className="px-6 py-4 text-right">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1FA]">
                {loadingVehicles && vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[#9BA4C0]">
                      <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                      데이터를 불러오는 중...
                    </td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-[#9BA4C0]">검색 결과가 없습니다.</td>
                  </tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id} className="hover:bg-[#F8F9FC] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-[#9BA4C0] font-bold uppercase">{v.brand}</span>
                          <span className="font-bold text-[#1A1A2E]">{v.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-center">
                          <input
                            type="number"
                            step="0.1"
                            defaultValue={v.surchargeRate || 0}
                            onBlur={(e) => handleUpdateVehicleSurcharge(v.id, parseFloat(e.target.value))}
                            className="w-20 px-2 py-1.5 bg-gray-50 border border-transparent hover:border-[#E8EAF0] rounded-lg text-center font-mono text-sm focus:bg-white focus:border-[#6066EE] transition-all"
                          />
                          {savingId === v.id && <Loader2 className="animate-spin text-[#6066EE]" size={14} />}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${v.isVisible ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                          {v.isVisible ? '활성' : '비활성'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. 금융사 프로모션 가산 */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl text-emerald-500">
            <Landmark size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">03. 금융사 프로모션 가산</h2>
            <p className="text-sm text-[#9BA4C0]">특정 금융사 이용 시 일률적으로 적용할 가산 정책을 설정합니다.</p>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl border border-[#E8EAF0] overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FC] border-b border-[#E8EAF0] text-[#9BA4C0] text-[11px] uppercase">
              <tr>
                <th className="px-6 py-4 text-left font-bold">금융사명</th>
                <th className="px-6 py-4 text-center w-36 font-bold">가산율 (%)</th>
                <th className="px-6 py-4 text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1FA]">
              {fcs.map((fc) => (
                <tr key={fc.id} className="hover:bg-[#F8F9FC] transition-colors">
                  <td className="px-6 py-4 font-bold text-[#1A1A2E]">{fc.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={fc.surchargeRate}
                        onBlur={(e) => handleUpdateFcSurcharge(fc.id, parseFloat(e.target.value))}
                        className="w-20 px-2 py-1.5 bg-gray-50 border border-transparent hover:border-[#E8EAF0] rounded-lg text-center font-mono text-sm focus:bg-white focus:border-[#6066EE] transition-all"
                      />
                      {savingId === fc.id && <Loader2 className="animate-spin text-[#6066EE]" size={14} />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${fc.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                      {fc.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
