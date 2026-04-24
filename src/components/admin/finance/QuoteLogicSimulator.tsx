"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, ArrowRight, TrendingUp, CarFront, Landmark, Calculator } from "lucide-react";
import { calculateMultiFinanceQuote, type RateConfigData, type CalcInput } from "@/lib/quote-calculator";
import type { FinanceQuoteResult } from "@/types/quote";

export default function QuoteLogicSimulator() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [selectedTrim, setSelectedTrim] = useState<any>(null);
  const [months, setMonths] = useState(48);
  const [mileage, setMileage] = useState(20000);
  const [depositRate, setDepositRate] = useState(0);
  const [prepayRate, setPrepayRate] = useState(0);
  const [results, setResults] = useState<FinanceQuoteResult[]>([]);
  const [rankRates, setRankRates] = useState<number[]>([1, 1.5, 2, 2.5]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [vRes, pRes] = await Promise.all([
          fetch("/api/admin/vehicles?includeTrims=true"),
          fetch("/api/admin/settings/policy")
        ]);
        const vData = await vRes.json();
        const pData = await pRes.json();
        
        if (vData.success) setVehicles(vData.data);
        if (pData.success) {
          const rates = pData.data.sort((a: any, b: any) => a.rank - b.rank).map((r: any) => r.rate);
          if (rates.length > 0) setRankRates(rates);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // 브랜드별 그룹화
  const groupedVehicles = vehicles.reduce((acc: any, v) => {
    if (!acc[v.brand]) acc[v.brand] = [];
    acc[v.brand].push(v);
    return acc;
  }, {});

  const handleCalculate = async () => {
    if (!selectedTrim) return;
    
    // 회수율 데이터 가져오기
    const res = await fetch(`/api/admin/capital-rates?trimId=${selectedTrim.id}`);
    const data = await res.json();
    if (!data.success || data.data.length === 0) {
      alert("이 트림에 대한 회수율 데이터가 등록되어 있지 않습니다. '회수율 데이터 관리' 탭에서 먼저 데이터를 등록해 주세요.");
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
      vehiclePrice: selectedTrim.price,
      contractMonths: months,
      annualMileage: mileage,
      depositRate,
      prepayRate,
      vehicleSurchargeRate: (selectedVehicle.surchargeRate || 0),
      rankSurchargeRates: rankRates,
      rateConfigs: configs,
    };

    const out = calculateMultiFinanceQuote(input);
    setResults(out);
  };

  if (loading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#6066EE]" /></div>;

  return (
    <div className="space-y-6">
      {/* 설정 바 */}
      <div className="bg-white rounded-2xl border border-[#E8EAF0] p-6 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">차량 선택</label>
          <select 
            className="w-full px-3 py-2 bg-[#F8F9FC] border border-[#E8EAF0] rounded-xl text-xs focus:outline-none focus:border-[#6066EE] appearance-none"
            onChange={(e) => {
              const v = vehicles.find(v => v.id === e.target.value);
              setSelectedVehicle(v);
              setSelectedTrim(v?.trims?.[0] || null);
            }}
          >
            <option value="">차량 선택</option>
            {Object.keys(groupedVehicles).map(brand => (
              <optgroup key={brand} label={brand}>
                {groupedVehicles[brand].map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {selectedVehicle && (
          <div className="flex-1 min-w-[140px] space-y-1 animate-in fade-in zoom-in duration-200">
            <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">트림 선택</label>
            <select 
              className="w-full px-3 py-2 bg-[#F8F9FC] border border-[#E8EAF0] rounded-xl text-xs focus:outline-none focus:border-[#6066EE] appearance-none"
              value={selectedTrim?.id || ""}
              onChange={(e) => setSelectedTrim(selectedVehicle.trims.find((t:any) => t.id === e.target.value))}
            >
              <option value="" disabled>트림 선택</option>
              {selectedVehicle.trims?.map((t:any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.price.toLocaleString()}원)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">사용 조건</label>
            <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
              {[36, 48, 60].map(m => (
                <button key={m} onClick={() => setMonths(m)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${months === m ? 'bg-white shadow-sm text-[#6066EE]' : 'text-[#9BA4C0]'}`}>{m}개월</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">주행 거리</label>
            <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
              {[10000, 20000, 30000].map(m => (
                <button key={m} onClick={() => setMileage(m)} className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${mileage === m ? 'bg-white shadow-sm text-[#6066EE]' : 'text-[#9BA4C0]'}`}>{m/10000}만</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">보증금</label>
            <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
              {[0, 10, 20, 30].map(r => (
                <button 
                  key={r} 
                  onClick={() => { setDepositRate(r); if (r > 0) setPrepayRate(0); }} 
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${depositRate === r ? 'bg-white shadow-sm text-[#6066EE]' : 'text-[#9BA4C0]'}`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#9BA4C0] ml-1">선납금</label>
            <div className="flex bg-[#F8F9FC] p-1 rounded-xl border border-[#E8EAF0]">
              {[0, 10, 20, 30].map(r => (
                <button 
                  key={r} 
                  onClick={() => { setPrepayRate(r); if (r > 0) setDepositRate(0); }} 
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${prepayRate === r ? 'bg-white shadow-sm text-[#6066EE]' : 'text-[#9BA4C0]'}`}
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={handleCalculate}
          disabled={!selectedTrim}
          className="px-6 py-2 bg-[#000666] text-white rounded-xl text-xs font-bold hover:bg-[#000888] transition-all disabled:opacity-50"
        >
          시뮬레이션 실행
        </button>
      </div>

      {/* 시뮬레이션 결과 테이블 */}
      {results.length > 0 && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-2">
                <TrendingUp size={16} className="text-[#6066EE]" />
                단계별 가산 로직 분해
              </h3>
              <p className="text-[11px] text-[#9BA4C0]">최종 고객 표출 가격 기준으로 정렬되었습니다.</p>
           </div>

           <div className="bg-white rounded-2xl border border-[#E8EAF0] overflow-hidden shadow-md shadow-indigo-50/30">
             <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E8EAF0] text-[#9BA4C0] text-[11px] uppercase">
                    <th className="px-6 py-4 text-left font-bold">금융사</th>
                    <th className="px-6 py-4 text-center font-bold bg-blue-50/30">기본 로직 (0%)</th>
                    <th className="px-6 py-4 text-center font-bold">순위 가산</th>
                    <th className="px-6 py-4 text-center font-bold">차량 가산</th>
                    <th className="px-6 py-4 text-center font-bold">금융사 가산</th>
                    <th className="px-6 py-4 text-right font-bold bg-[#6066EE]/5 text-[#6066EE]">고객 표출 최종</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F1FA]">
                  {results.map((r, i) => {
                    const basePrice = r.breakdown.monthlyBeforeSurcharge;
                    const afterRank = basePrice + r.surcharges.rankSurcharge;
                    const afterVehicle = afterRank + r.surcharges.vehicleSurcharge;
                    
                    return (
                    <tr key={r.financeCompanyId} className="group hover:bg-[#F8F9FC] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                             <span className="w-5 h-5 rounded-full bg-[#1A1A2E] text-white text-[10px] flex items-center justify-center font-black">{i + 1}</span>
                             <span className="font-bold text-[#1A1A2E]">{r.financeCompanyName}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 bg-blue-50/10">
                        <p className="text-center font-mono font-medium text-[#5A6080]">{Math.round(basePrice).toLocaleString()}원</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center">
                          <p className="text-[10px] text-red-400 font-bold">+{r.surcharges.rankSurcharge.toLocaleString()}</p>
                          <p className="font-mono text-xs">{afterRank.toLocaleString()}원</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center">
                          <p className="text-[10px] text-orange-400 font-bold">+{r.surcharges.vehicleSurcharge.toLocaleString()}</p>
                          <p className="font-mono text-xs">{afterVehicle.toLocaleString()}원</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center">
                          <p className={`text-[10px] font-bold ${r.surcharges.financeSurcharge >= 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                            {r.surcharges.financeSurcharge > 0 ? '+' : ''}{r.surcharges.financeSurcharge.toLocaleString()}
                          </p>
                          <p className="font-mono text-xs">{r.monthlyPayment.toLocaleString()}원</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 bg-[#6066EE]/5 text-right">
                        <p className="text-lg font-black text-[#6066EE] tracking-tighter">{r.monthlyPayment.toLocaleString()}원</p>
                      </td>
                    </tr>
                  )})}
                </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
}
