"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, BarChart2, Calendar, FileText, ArrowUpRight, ChevronDown, Download, Users
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- MOCK DATA ---
const TREND_DATA = [
  45, 52, 48, 61, 59, 75, 82, 85, 78, 92, 105, 110, 95, 88, 102, 115, 125, 132, 140, 135, 142, 155, 160, 158, 170, 185, 192, 180, 205, 220
];
const LEADERBOARD_DATA = [
  { name: "쏘렌토", brand: "기아", count: 2140, color: "#000666" },
  { name: "아이오닉 6", brand: "현대", count: 1850, color: "#2A2A72" },
  { name: "투싼", brand: "현대", count: 1420, color: "#4B4B99" },
  { name: "EV6", brand: "기아", count: 980, color: "#6C6CBF" },
  { name: "GV80", brand: "제네시스", count: 650, color: "#8E8ee6" },
];
const POWERTRAIN_DATA = [
  { label: "하이브리드", value: 65, color: "#000666" },
  { label: "가솔린 & 디젤", value: 25, color: "#6066EE" },
  { label: "전기 (EV)", value: 10, color: "#B0B5D0" },
];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState("최근 30일");

  // 선 그래프 그리기 위한 헬퍼 (SVG 기반)
  const maxTrend = Math.max(...TREND_DATA);
  const minTrend = Math.min(...TREND_DATA);
  const getLinePath = () => {
    // Canvas: X=0~1000, Y=0~300
    const w = 1000;
    const h = 300;
    const points = TREND_DATA.map((val, i) => {
      const x = (i / (TREND_DATA.length - 1)) * w;
      const y = h - ((val - minTrend * 0.8) / (maxTrend - minTrend * 0.8)) * h;
      return `${x},${y}`;
    });
    // Create soft curve (bezier) - simplified to standard polyline for demo, but we can make it smooth
    // For absolute smoothness in one standard string, we use straight lines here for accuracy and tech styling
    return `M ${points.join(" L ")}`;
  };

  const getAreaPath = () => {
    const line = getLinePath();
    return `${line} L 1000,300 L 0,300 Z`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}>
      {/* 헤더 */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#F4F5F8] rounded-[8px] text-[#000666]">
            <BarChart2 size={18} />
          </div>
          <div>
            <h1 className="text-[16px] font-bold text-[#1A1A2E]">데이터 분석 (Analytics)</h1>
            <p className="text-[11px] font-medium text-[#6B7399] mt-0.5">차량별 견적 발생량 및 방문자 트렌드 통계</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-[#E8EAF0] px-3.5 py-2.5 rounded-[8px] text-[12px] font-medium text-[#4A5270] hover:bg-[#F4F5F8] transition-colors">
            <Calendar size={14} className="text-[#9BA4C0]" />
            {dateRange} <ChevronDown size={14} className="ml-1 text-[#9BA4C0]" />
          </button>
          <button className="flex items-center gap-2 bg-[#F4F5F8] text-[#000666] px-4 py-2.5 rounded-[8px] text-[12px] font-bold hover:bg-[#E8EAF0] transition-colors">
            <Download size={14} /> 리포트 내보내기
          </button>
        </div>
      </div>

      {/* 내부 컴포넌트 래퍼 (스크롤 없음) */}
      <div className="flex-1 p-5 min-h-0 flex flex-col gap-5">
        
        {/* ROW 1: 상단 KPI (비율 0.3) */}
        <div className="flex gap-4 shrink-0">
          <KPICard title="총 견적 발생량" value="12,482" unit="건" trend="+15%" icon={FileText} />
          <KPICard title="견적 페이지 방문자" value="48,291" unit="명" trend="+8.2%" icon={Users} />
          <KPICard title="견적 완료 전환율" value="25.8" unit="%" trend="+2.4%" icon={TrendingUp} />
        </div>

        {/* ROW 2: 메인 차트 & 리더보드 (비율 1) */}
        <div className="flex-1 min-h-0 flex gap-5">
          
          {/* 하프 사이즈 1: 일간 트렌드 */}
          <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-6 flex flex-col flex-1 shadow-sm min-w-0">
            <div className="flex items-center justify-between shrink-0 mb-6">
              <div>
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">일간 견적 발행 트렌드</h2>
                <p className="text-[11px] text-[#6B7399] mt-1">지난 30일간의 서비스 사용 추이</p>
              </div>
              <span className="text-[20px] font-bold text-[#000666]">Total 12,482</span>
            </div>
            
            <div className="flex-1 relative min-h-0">
              <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000666" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#000666" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area Gradient */}
                <motion.path 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 1 }}
                  d={getAreaPath()} fill="url(#trendGrad)" 
                />
                {/* Main Line */}
                <motion.path 
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeOut" }}
                  d={getLinePath()} fill="none" stroke="#000666" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" 
                />
                {/* Data Points */}
                {TREND_DATA.map((val, i) => {
                  if (i % 5 !== 0 && i !== TREND_DATA.length - 1) return null; // 드문드문 점 표시
                  const x = (i / (TREND_DATA.length - 1)) * 1000;
                  const y = 300 - ((val - minTrend * 0.8) / (maxTrend - minTrend * 0.8)) * 300;
                  return (
                    <motion.circle 
                      key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + i*0.02 }}
                      cx={x} cy={y} r="6" fill="white" stroke="#000666" strokeWidth="3" 
                    />
                  );
                })}
              </svg>
            </div>
          </section>

          {/* 하프 사이즈 2의 분할 영역: 리더보드 & 파이 차트 */}
          <div className="flex flex-col gap-5 w-[400px] shrink-0">
            
            {/* Top Vehicles */}
            <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex flex-col flex-[1.4] shadow-sm min-h-0 overflow-hidden">
              <div className="shrink-0 mb-4">
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">차량별 누적 견적 발생 순위</h2>
                <p className="text-[11px] text-[#6B7399] mt-0.5">상위 5개 모델 랭킹</p>
              </div>
              <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-2">
                {LEADERBOARD_DATA.map((item, idx) => {
                  const max = LEADERBOARD_DATA[0].count;
                  const percent = (item.count / max) * 100;
                  return (
                    <div key={item.name} className="flex flex-col gap-1.5 mb-3 last:mb-0">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-bold text-[#1A1A2E] flex items-center gap-2">
                          <span className="text-[11px] font-black text-[#9BA4C0] w-4">{idx + 1}</span>
                          {item.name}
                        </span>
                        <span className="font-bold text-[#000666]">{item.count.toLocaleString()}건</span>
                      </div>
                      <div className="h-2 w-full bg-[#F0F2F8] rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1, ease: "easeOut", delay: idx * 0.1 }}
                          className="h-full rounded-full" style={{ backgroundColor: item.color }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Powertrain Distribution */}
            <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex items-center flex-[1] shadow-sm min-h-0">
              <div className="flex-1">
                <h2 className="text-[14px] font-bold text-[#1A1A2E] mb-1">파워트레인 선호도</h2>
                <p className="text-[11px] text-[#6B7399]">전체 생성 견적 기준 (하이브리드 압도적)</p>
                <div className="mt-4 space-y-2">
                  {POWERTRAIN_DATA.map(pt => (
                    <div key={pt.label} className="flex items-center gap-2 text-[11px] font-medium text-[#4A5270]">
                      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: pt.color }} />
                      <span className="flex-1">{pt.label}</span>
                      <span className="font-bold text-[#1A1A2E]">{pt.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-[120px] h-[120px] relative shrink-0">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                  {POWERTRAIN_DATA.map((pt, i) => {
                    // Quick math for pie
                    const prevValues = POWERTRAIN_DATA.slice(0, i).reduce((sum, item) => sum + item.value, 0);
                    const strokeDasharray = `${pt.value} 100`;
                    const strokeDashoffset = -prevValues;
                    return (
                      <motion.circle
                        key={pt.label} cx="50" cy="50" r="40" fill="transparent"
                        stroke={pt.color} strokeWidth="16" // Thickness
                        strokeDasharray={strokeDasharray}
                        initial={{ strokeDashoffset: -100 }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    );
                  })}
                </svg>
              </div>
            </section>
            
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, unit, trend, icon: Icon }: any) {
  return (
    <div className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex-1 flex items-start justify-between shadow-sm relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 text-[#F8F9FC] group-hover:text-[#F0F2F8] transition-colors">
        <Icon size={100} strokeWidth={1} />
      </div>
      <div className="relative z-10 flex flex-col">
        <span className="text-[12px] font-medium text-[#6B7399] mb-1">{title}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-[26px] font-bold text-[#1A1A2E] tracking-tight">{value}</span>
          <span className="text-[12px] text-[#4A5270] font-medium">{unit}</span>
        </div>
        <div className="flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[4px] w-fit">
          <ArrowUpRight size={12} /> {trend}
        </div>
      </div>
    </div>
  );
}
