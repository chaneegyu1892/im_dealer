'use client';

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2, History, Settings2, Activity,
  AlertCircle, CheckCircle2, TrendingUp, Edit,
  Building2, ChevronDown, ChevronRight, Layers
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
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set(["전체"]));

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // URL 파라미터(?search=...) 연동
  useEffect(() => {
    const s = searchParams.get("search");
    if (s) {
      setSearch(s);
    }
  }, [searchParams]);

  // 브랜드별 모델 트리 생성
  const vehicleTree = useMemo(() => {
    const tree: Record<string, Set<string>> = {};
    rates.forEach(item => {
      if (!tree[item.brand]) tree[item.brand] = new Set();
      tree[item.brand].add(item.vehicleName);
    });
    return tree;
  }, [rates]);

  // 현재 선택된 브랜드 및 검색어에 맞는 데이터 필터링
  const filteredRates = useMemo(() => {
    let result = rates;

    // 검색어가 있으면 브랜드/모델 필터보다 검색 우선 (사용자 요청: 검색 기능 유지)
    if (search) {
      return result.filter(item =>
        item.vehicleName.toLowerCase().includes(search.toLowerCase()) ||
        item.brand.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (selectedBrand !== "전체") {
      result = result.filter(item => item.brand === selectedBrand);
    }

    if (selectedModel) {
      result = result.filter(item => item.vehicleName === selectedModel);
    }

    return result;
  }, [rates, selectedBrand, selectedModel, search]);

  const toggleBrand = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
    setSelectedBrand(brand);
    setSelectedModel(null); // 브랜드 클릭 시 모델 선택 초기화
  };

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
        <div className="w-[200px] bg-white border-r border-[#E8EAF0] flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-[#F0F2F8] flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-[#6B7399] uppercase tracking-wider">차량 탐색</h2>
            <Layers size={12} className="text-[#9BA4C0]" />
          </div>
          <div className="flex-1 overflow-y-auto w-full py-2 custom-scrollbar">
            {/* 전체 선택 */}
            <button
              onClick={() => {
                setSelectedBrand("전체");
                setSelectedModel(null);
                setSearch("");
              }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-medium transition-colors",
                selectedBrand === "전체" && !search
                  ? "bg-[#F4F5F8] text-[#000666] border-r-2 border-[#000666]"
                  : "text-[#4A5270] hover:bg-[#FAFBFF]"
              )}
            >
              <span>전체 보기</span>
              <span className="text-[10px] text-[#9BA4C0]">{rates.length}</span>
            </button>

            <div className="my-1 border-t border-[#F0F2F8]" />

            {VEHICLE_BRANDS.map((brand) => {
               const models = Array.from(vehicleTree[brand] || []);
               const isExpanded = expandedBrands.has(brand);
               const isSelected = selectedBrand === brand;

               return (
                 <div key={brand} className="flex flex-col">
                   <button
                     onClick={() => toggleBrand(brand)}
                     className={cn(
                       "w-full flex items-center justify-between px-4 py-2.5 text-[13px] font-semibold transition-colors",
                       isSelected && !selectedModel
                         ? "text-[#000666]"
                         : "text-[#1A1A2E] hover:bg-[#FAFBFF]"
                     )}
                   >
                     <div className="flex items-center gap-2">
                       {isExpanded ? <ChevronDown size={14} className="text-[#9BA4C0]" /> : <ChevronRight size={14} className="text-[#9BA4C0]" />}
                       <span>{brand}</span>
                     </div>
                     <span className="text-[10px] text-[#9BA4C0]">{models.length}</span>
                   </button>

                   <AnimatePresence>
                     {isExpanded && (
                       <motion.div
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: "auto", opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden bg-[#F9FAFC]"
                       >
                         {models.map(model => (
                           <button
                             key={model}
                             onClick={() => {
                               setSelectedBrand(brand);
                               setSelectedModel(model);
                               setSearch(""); // 모델 선택 시 검색어 초기화 (또는 유지 가능)
                             }}
                             className={cn(
                               "w-full flex items-center pl-9 pr-4 py-2 text-[12px] transition-colors text-left",
                               selectedModel === model
                                 ? "text-[#000666] font-bold bg-[#E5E5FA]"
                                 : "text-[#6B7399] hover:bg-[#F0F2F8] hover:text-[#1A1A2E]"
                             )}
                           >
                             <span className="truncate">{model.replace(brand, '').trim() || model}</span>
                           </button>
                         ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
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
              currentBrand={selectedModel || selectedBrand}
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
