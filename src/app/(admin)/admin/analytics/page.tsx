"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, BarChart2, Calendar, FileText, ArrowUpRight,
  ChevronDown, Download, Users, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TREND_DATA_30D,
  VEHICLE_QUOTE_RANK,
  POWERTRAIN_DATA,
  WEEKLY_QUOTE_DATA,
  MONTHLY_CONSULTATION_DATA,
} from "@/constants/mock-data";

// ─── 기간별 데이터 매핑 ──────────────────────────────────────────
const RANGE_OPTIONS = ["일간", "주간", "월간"] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

const RANGE_DATA: Record<RangeOption, {
  data: number[];
  labels: string[];
  total: number;
  visitors: number;
  rate: number;
}> = {
  일간: {
    data: TREND_DATA_30D,
    labels: Array.from({ length: 30 }, (_, i) => `${i + 1}일`),
    total: 611,
    visitors: 2443,
    rate: 17.0,
  },
  주간: {
    data: [52, 78, 91, 68, 103, 112, 107],
    labels: ["1주", "2주", "3주", "4주", "5주", "6주", "7주"],
    total: 611,
    visitors: 2443,
    rate: 17.0,
  },
  월간: {
    data: MONTHLY_CONSULTATION_DATA.map(d => d.value * 32),
    labels: MONTHLY_CONSULTATION_DATA.map(d => d.label),
    total: 611,
    visitors: 2443,
    rate: 17.0,
  },
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeOption>("일간");
  const [rangeOpen, setRangeOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const current = RANGE_DATA[range];
  const { data: trendData, labels: trendLabels, total, visitors, rate } = current;

  const maxTrend = Math.max(...trendData);
  const minTrend = Math.min(...trendData);

  const getLinePath = (d: number[]) => {
    const w = 1000; const h = 300;
    const points = d.map((val, i) => {
      const x = (i / (d.length - 1)) * w;
      const y = h - ((val - minTrend * 0.8) / (maxTrend - minTrend * 0.8)) * h;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const getAreaPath = (d: number[]) => `${getLinePath(d)} L 1000,300 L 0,300 Z`;

  const handleExportPDF = () => {
    // PDF 인쇄 다이얼로그를 통한 내보내기
    const style = document.createElement("style");
    style.id = "print-style";
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #analytics-report, #analytics-report * { visibility: visible; }
        #analytics-report { position: fixed; top: 0; left: 0; width: 100%; }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const el = document.getElementById("print-style");
      if (el) el.remove();
    }, 1000);
  };

  return (
    <div
      id="analytics-report"
      ref={printRef}
      className="flex flex-col h-[calc(100vh-32px)] m-4 rounded-[12px] bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
    >
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

        <div className="flex items-center gap-3 no-print">
          {/* 기간 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => setRangeOpen(o => !o)}
              className="flex items-center gap-2 bg-white border border-[#E8EAF0] px-3.5 py-2.5 rounded-[8px] text-[12px] font-medium text-[#4A5270] hover:bg-[#F4F5F8] transition-colors min-w-[140px]"
            >
              <Calendar size={14} className="text-[#9BA4C0]" />
              {range} 기준
              <ChevronDown size={14} className={cn("ml-auto text-[#9BA4C0] transition-transform duration-200", rangeOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {rangeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-[calc(100%+6px)] right-0 w-[160px] bg-white border border-[#E8EAF0] rounded-[10px] shadow-lg overflow-hidden z-30"
                >
                  {RANGE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => { setRange(opt); setRangeOpen(false); }}
                      className="flex items-center justify-between w-full px-4 py-2.5 text-[13px] text-[#4A5270] hover:bg-[#F4F5F8] transition-colors"
                    >
                      {opt} 기준
                      {range === opt && <Check size={13} className="text-[#000666]" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* PDF 내보내기 */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-[#000666] text-white px-4 py-2.5 rounded-[8px] text-[12px] font-bold hover:opacity-90 transition-opacity"
          >
            <Download size={14} /> PDF 리포트 내보내기
          </button>
        </div>
      </div>

      {/* 내부 컴포넌트 래퍼 */}
      <div className="flex-1 p-5 min-h-0 flex flex-col gap-5">

        {/* ROW 1: KPI */}
        <div className="flex gap-4 shrink-0">
          <KPICard title={`총 견적 발생량 (${range})`} value={total.toLocaleString()} unit="건" trend="+12%" icon={FileText} />
          <KPICard title="견적 페이지 방문자" value={visitors.toLocaleString()} unit="명" trend="+9.4%" icon={Users} />
          <KPICard title="견적 완료 전환율" value={rate.toFixed(1)} unit="%" trend="+2.0%" icon={TrendingUp} />
        </div>

        {/* ROW 2: 차트 & 리더보드 */}
        <div className="flex-1 min-h-0 flex gap-5">

          {/* 트렌드 차트 */}
          <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-6 flex flex-col flex-1 shadow-sm min-w-0">
            <div className="flex items-center justify-between shrink-0 mb-6">
              <div>
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">견적 발행 트렌드</h2>
                <p className="text-[11px] text-[#6B7399] mt-1">
                  {range === "일간" ? "지난 30일간" : range === "주간" ? "최근 7주간" : "서비스 시작 이후 월별"} 사용 추이
                </p>
              </div>
              <span className="text-[20px] font-bold text-[#000666]">Total {total.toLocaleString()}건</span>
            </div>

            <div className="flex-1 relative min-h-0">
              <svg viewBox="0 0 1000 300" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#000666" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#000666" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path
                  key={`area-${range}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
                  d={getAreaPath(trendData)} fill="url(#trendGrad)"
                />
                <motion.path
                  key={`line-${range}`}
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }}
                  d={getLinePath(trendData)} fill="none" stroke="#000666" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                />
                {trendData.map((val, i) => {
                  const step = Math.max(1, Math.floor(trendData.length / 7));
                  if (i % step !== 0 && i !== trendData.length - 1) return null;
                  const x = (i / (trendData.length - 1)) * 1000;
                  const y = 300 - ((val - minTrend * 0.8) / (maxTrend - minTrend * 0.8)) * 300;
                  return (
                    <motion.g key={`pt-${range}-${i}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.03 }}>
                      <circle cx={x} cy={y} r="8" fill="white" stroke="#000666" strokeWidth="3" />
                      <text x={x} y={y - 14} textAnchor="middle" fontSize="20" fill="#6B7399" fontWeight="600">{val}</text>
                      <text x={x} y={295} textAnchor="middle" fontSize="18" fill="#B0B5CC">{trendLabels[i]}</text>
                    </motion.g>
                  );
                })}
              </svg>
            </div>
          </section>

          {/* 우측 사이드 */}
          <div className="flex flex-col gap-5 w-[400px] shrink-0">

            {/* 차량별 순위 */}
            <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex flex-col flex-[1.4] shadow-sm min-h-0 overflow-hidden">
              <div className="shrink-0 mb-4">
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">차량별 누적 견적 발생 순위</h2>
                <p className="text-[11px] text-[#6B7399] mt-0.5">상위 5개 모델 랭킹</p>
              </div>
              <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-2">
                {VEHICLE_QUOTE_RANK.map((item, idx) => {
                  const max = VEHICLE_QUOTE_RANK[0].count;
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
                          key={`bar-${item.name}`}
                          initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1, ease: "easeOut", delay: idx * 0.1 }}
                          className="h-full rounded-full" style={{ backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 파워트레인 분포 */}
            <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex items-center flex-[1] shadow-sm min-h-0">
              <div className="flex-1">
                <h2 className="text-[14px] font-bold text-[#1A1A2E] mb-1">파워트레인 선호도</h2>
                <p className="text-[11px] text-[#6B7399]">1~4월 누적 견적 기준</p>
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
                    const prevValues = POWERTRAIN_DATA.slice(0, i).reduce((sum, item) => sum + item.value, 0);
                    return (
                      <motion.circle
                        key={pt.label} cx="50" cy="50" r="40" fill="transparent"
                        stroke={pt.color} strokeWidth="16"
                        strokeDasharray={`${pt.value} 100`}
                        initial={{ strokeDashoffset: -100 }}
                        animate={{ strokeDashoffset: -prevValues }}
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

function KPICard({ title, value, unit, trend, icon: Icon }: { title: string; value: string; unit: string; trend: string; icon: React.ElementType }) {
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
