"use client";

import { TrendingUp, Users, Target, MousePointer2 } from "lucide-react";

interface Props {
  data: any;
}

export default function AiInsightDashboard({ data }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* 주요 지표 카드 */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8EAF2] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Users size={20} />
          </div>
          <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Total</span>
        </div>
        <div>
          <p className="text-xs text-[#9BA4C0] font-medium">전체 추천 횟수</p>
          <p className="text-2xl font-black text-[#1A1A2E] mt-1">{data.totalRecommendations.toLocaleString()}건</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-[#E8EAF2] shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
            <Target size={20} />
          </div>
          <span className="text-[10px] font-bold text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded">Personas</span>
        </div>
        <div>
          <p className="text-xs text-[#9BA4C0] font-medium">인기 페르소나</p>
          <p className="text-sm font-bold text-[#1A1A2E] mt-1 truncate">
            {data.popularPersonas[0]?.industry} &gt; {data.popularPersonas[0]?.purpose}
          </p>
        </div>
      </div>

      {/* 최다 추천 차량 */}
      <div className="md:col-span-2 bg-white p-5 rounded-2xl border border-[#E8EAF2] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#1A1A2E] flex items-center gap-1.5">
            <TrendingUp size={16} className="text-[#6066EE]" />
            성능 기반 최다 추천 차량 (TOP 5)
          </h3>
          <span className="text-[10px] text-[#9BA4C0]">최근 200건 기준</span>
        </div>
        <div className="space-y-3">
          {data.topRecommendedVehicles.map((v: any, i: number) => (
            <div key={v.vehicleId} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-[#9BA4C0] w-3">0{i + 1}</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#1A1A2E]">{v.name}</span>
                  <span className="text-[10px] text-[#9BA4C0]">{v.brand}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-[#9BA4C0]">추천수</span>
                  <span className="text-xs font-bold text-[#1A1A2E]">{v.recommendCount}</span>
                </div>
                <div className="flex flex-col items-end w-16">
                  <span className="text-[10px] text-[#9BA4C0]">CTR</span>
                  <div className="flex items-center gap-1">
                    <MousePointer2 size={10} className="text-blue-500" />
                    <span className="text-xs font-bold text-blue-500">{v.ctr.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
