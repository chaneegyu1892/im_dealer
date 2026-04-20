export const dynamic = 'force-dynamic';
"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
  BarChart2, History, Settings2, Activity, 
  AlertCircle, CheckCircle2, TrendingUp, Edit,
  Building2, Layers
} from "lucide-react";
import { 
  MOCK_RECOVERY_RATES, 
  MOCK_RECOVERY_HISTORY, 
  RECOVERY_RATE_STATS,
  RecoveryRateItem,
  VEHICLE_BRANDS
} from "@/constants/mock-data";
import { RecoveryRateTable } from "@/components/admin/recovery-rates/RecoveryRateTable";
import { BatchUpdateModal } from "@/components/admin/recovery-rates/BatchUpdateModal";
import { RateHistoryTimeline } from "@/components/admin/recovery-rates/RateHistoryTimeline";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function RecoveryRatesContent() {
  const searchParams = useSearchParams();
  const [rates, setRates] = useState<RecoveryRateItem[]>(MOCK_RECOVERY_RATES);
  const [history, setHistory] = useState(MOCK_RECOVERY_HISTORY);
  
  const [selectedBrand, setSelectedBrand] = useState("전체");
  const [search, setSearch] = useState("");
  
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // URL 파라미터(?search=...) 연동
  useEffect(() => {
    const s = searchParams.get("search");
    if (s) {
      setSearch(s);
    }
  }, [searchParams]);

  // 현재 선택된 브랜드 및 검색어에 맞는 데이터 필터링
  const filteredRates = useMemo(() => {
    let result = rates;
    if (selectedBrand !== "전체") {
      result = result.filter(item => item.brand === selectedBrand);
    }
    if (search) {
      result = result.filter(item => 
        item.vehicleName.toLowerCase().includes(search.toLowerCase())
      );
    }
    return result;
  }, [rates, selectedBrand, search]);

  const handleUpdateRate = (id: string, field: string, newValue: number) => {
    setRates(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: newValue, updatedAt: new Date().toISOString().split('T')[0] };
      }
      return item;
    }));

    const item = rates.find(r => r.id === id);
    if (item) {
      const newHistory = {
        id: `RH-${Date.now()}`,
        vehicleName: item.vehicleName,
        field: field === 'baseRate' ? '기본 잔존가치율' : field,
        oldValue: (item as any)[field] as number,
        newValue,
        changedBy: "현재(나)",
        changedAt: new Date().toISOString(),
        reason: "인라인 수정",
      };
      setHistory(prev => [newHistory, ...prev]);
    }
  };

  const handleBatchApply = (params: any) => {
    alert(`[일괄 적용 대상: ${params.brand} > ${params.category}]\n수치: ${params.adjustmentType === 'increase' ? '+' : '-'}${params.value}%\n사유: ${params.reason}`);
    const factor = params.adjustmentType === 'increase' ? 1 : -1;
    const diff = params.value * factor;
    
    setRates(prev => prev.map(item => {
      const matchBrand = params.brand === "전체" || item.brand === params.brand;
      const matchCategory = params.category === "전체" || item.category === params.category;
      
      if (matchBrand && matchCategory) {
        return { ...item, baseRate: item.baseRate + diff };
      }
      return item;
    }));

    const newHistory = {
      id: `RH-BATCH-${Date.now()}`,
      vehicleName: `${params.brand} > ${params.category} 전체`,
      field: '기본 잔존가치율',
      oldValue: 0,
      newValue: diff,
      changedBy: "현재(나)",
      changedAt: new Date().toISOString(),
      reason: params.reason,
    };
    setHistory(prev => [newHistory, ...prev]);
  };

  const todayStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const ALL_BRANDS = ["전체", ...VEHICLE_BRANDS, "수입/기타"];

  return (
    <div className="relative flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm">
      {/* ── 헤더 & 전체 KPI ── */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-5 shrink-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-[#8890AA] mb-1">{todayStr}</p>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-tight flex items-center gap-2">
              <Settings2 size={18} className="text-[#000666]" strokeWidth={2} />
              회수율 설정
            </h1>
            <p className="text-[12px] text-[#6B7399] mt-1">차종, 연식, 주행거리별 기준 회수율(잔존가치율)을 관리합니다.</p>
          </div>

          <div className="flex gap-2 isolate">
            <button 
              onClick={() => setIsTimelineOpen(true)}
              className="flex items-center gap-1.5 px-4 h-10 bg-white border border-[#E8EAF0] rounded-[6px] text-[12px] font-bold text-[#4A5270] hover:bg-[#F4F5F8] transition-colors shadow-sm"
            >
              <History size={14} /> 이력 조회
            </button>
            <button 
              onClick={() => setIsBatchModalOpen(true)}
              className="flex items-center gap-1.5 px-4 h-10 bg-[#000666] text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 transition-opacity shadow-sm"
            >
              <Edit size={14} /> 일괄 수정 적용
            </button>
          </div>
        </div>

        {/* 미니 KPI 칩 영역 */}
        <div className="mt-4 flex items-center divide-x divide-[#E8EAF0]">
          <div className="pr-5">
             <p className="text-[10px] text-[#9BA4C0] font-medium leading-none mb-1">관리 차종</p>
             <p className="text-[16px] font-bold tracking-tight text-[#000666]">
               {RECOVERY_RATE_STATS.totalModels} <span className="text-[11px] font-normal text-[#9BA4C0]">종</span>
             </p>
          </div>
          <div className="px-5">
             <p className="text-[10px] text-[#9BA4C0] font-medium leading-none mb-1">평균 기준 회수율</p>
             <p className="text-[16px] font-bold tracking-tight text-emerald-700">
               {RECOVERY_RATE_STATS.avgBaseRate} <span className="text-[11px] font-normal text-[#9BA4C0]">%</span>
             </p>
          </div>
          <div className="px-5">
             <p className="text-[10px] text-[#9BA4C0] font-medium leading-none mb-1">검토 필요</p>
             <p className="text-[16px] font-bold tracking-tight text-amber-600">
               {RECOVERY_RATE_STATS.pendingReview} <span className="text-[11px] font-normal text-[#9BA4C0]">건</span>
             </p>
          </div>
          <div className="pl-5">
             <p className="text-[10px] text-[#9BA4C0] font-medium leading-none mb-1">최근 업데이트</p>
             <p className="text-[13px] font-bold tracking-tight text-[#6B7399] mt-0.5">
               {RECOVERY_RATE_STATS.lastUpdated}
             </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── 좌측 브랜드 목록 (사이드바) ── */}
        <div className="w-[180px] bg-white border-r border-[#E8EAF0] flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-[#F0F2F8]">
            <h2 className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">브랜드 목록</h2>
          </div>
          <div className="flex-1 overflow-y-auto w-full py-2">
            {ALL_BRANDS.map((brand) => {
               const count = brand === "전체" 
                 ? rates.length 
                 : rates.filter(r => r.brand === brand || (brand === "수입/기타" && !VEHICLE_BRANDS.includes(r.brand))).length;
               
               return (
                 <button
                   key={brand}
                   onClick={() => setSelectedBrand(brand)}
                   className={cn(
                     "w-full flex items-center justify-between px-4 py-3 text-[13px] font-medium transition-colors",
                     selectedBrand === brand
                       ? "bg-[#F4F5F8] text-[#000666] border-r-2 border-[#000666]"
                       : "text-[#4A5270] hover:bg-[#FAFBFF] hover:text-[#1A1A2E]"
                   )}
                 >
                   <span className="truncate">{brand}</span>
                   <span className={cn(
                     "text-[10px] px-1.5 py-0.5 rounded-[4px]",
                     selectedBrand === brand ? "bg-[#000666] text-white" : "bg-[#F0F2F8] text-[#9BA4C0]"
                   )}>
                     {count}
                   </span>
                 </button>
               )
            })}
          </div>
        </div>

        {/* ── 우측 메인 콘텐츠 ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#FAFBFF]">
          {/* 테이블 컴포넌트 렌더링 영역 - 스크롤은 테이블 내부에서 관리 */}
          <div className="flex-1 p-5 overflow-hidden flex flex-col">
            <RecoveryRateTable 
              data={filteredRates} 
              onUpdateRate={handleUpdateRate} 
              currentBrand={selectedBrand}
            />
          </div>
        </div>
      </div>

      {/* ── 모달 및 타임라인 ── */}
      <BatchUpdateModal 
        isOpen={isBatchModalOpen} 
        onClose={() => setIsBatchModalOpen(false)} 
        onApply={handleBatchApply}
      />
      
      <RateHistoryTimeline 
        isOpen={isTimelineOpen} 
        onClose={() => setIsTimelineOpen(false)} 
        historyData={history} 
      />
    </div>
  );
}

export default function RecoveryRatesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-[#F8F9FC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000666]"></div>
      </div>
    }>
      <RecoveryRatesContent />
    </Suspense>
  );
}

