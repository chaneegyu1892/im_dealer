"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Eye, TrendingUp, Sparkles, ChevronLeft, ChevronRight,
  Plus, AlertCircle, CheckCircle2, MessageSquare, Clock, Star,
  BarChart2, Percent, Users, RefreshCw, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { logActivity, getActivities, AdminActivity } from "@/lib/activity-store";
import {
  DASHBOARD_STATS,
  WEEKLY_QUOTE_DATA,
  WEEKLY_AI_DATA,
  MONTHLY_CONSULTATION_DATA,
  CATEGORY_DIST,
  TOP_VEHICLES_DASHBOARD,
  RECENT_CONSULTATIONS_DASHBOARD,
  RECENT_ADMIN_ACTIVITY,
} from "@/constants/mock-data";

// ─── KPI 6개 (통합 목 데이터 기반) ─────────────────────────
const STATS = [
  { label: "등록 차량",    value: DASHBOARD_STATS.totalVehicles,          unit: "대", icon: Car,       trend: "+1",   isUp: true,  trendLabel: "전월 대비",  color: "#000666", bg: "#E5E5FA" },
  { label: "노출 중",      value: DASHBOARD_STATS.visibleVehicles,        unit: "대", icon: Eye,       trend: "-1",   isUp: false, trendLabel: "이번 달",   color: "#059669", bg: "#ECFDF5" },
  { label: "오늘 견적 조회", value: DASHBOARD_STATS.todayQuoteViews,      unit: "회", icon: TrendingUp, trend: "+5%",  isUp: true,  trendLabel: "어제 대비",  color: "#D97706", bg: "#FFFBEB" },
  { label: "AI 추천 세션", value: DASHBOARD_STATS.todayAISessions,        unit: "회", icon: Sparkles,  trend: "+20%", isUp: true,  trendLabel: "어제 대비",  color: "#7C3AED", bg: "#F5F3FF" },
  { label: "이달 신규 상담", value: DASHBOARD_STATS.monthlyConsultations, unit: "건", icon: Users,     trend: "+1",   isUp: true,  trendLabel: "지난달 대비", color: "#0EA5E9", bg: "#E0F2FE" },
  { label: "계약 전환율",  value: DASHBOARD_STATS.conversionRate,         unit: "%", icon: Percent,   trend: "+2%p", isUp: true,  trendLabel: "지난달 대비", color: "#059669", bg: "#ECFDF5" },
];

// ─── 차트 데이터 ─────────────────────────────────────────
type LineItem = { day: string; value: number };
type BarItem = { label: string; value: number };
type DonutItem = { label: string; count: number; color: string };
interface ChartDef {
  id: string; title: string; subtitle: string; type: "line" | "bar" | "donut"; color: string;
  lineData?: LineItem[]; barData?: BarItem[]; donutData?: DonutItem[];
  summary?: { label: string; value: number | string; unit: string }[];
}

// 주간 합계: 18+25+14+19+31+28+23 = 158, 평균 23, 최고 31
// AI 합계: 9+13+7+10+16+15+12 = 82, 평균 12, 최고 16
const CHARTS: ChartDef[] = [
  { id: "quotes", title: "주간 견적 조회 추이", subtitle: "최근 7일 (4/9~4/15)", type: "line",  color: "#D97706", lineData: WEEKLY_QUOTE_DATA,          summary: [{ label: "주간 합계", value: 158, unit: "회" }, { label: "일 평균", value: 23, unit: "회" }, { label: "최고치", value: 31, unit: "회" }] },
  { id: "ai",     title: "주간 AI 추천 세션",  subtitle: "최근 7일 (4/9~4/15)", type: "line",  color: "#7C3AED", lineData: WEEKLY_AI_DATA,             summary: [{ label: "주간 합계", value: 82,  unit: "회" }, { label: "일 평균", value: 12, unit: "회" }, { label: "최고치", value: 16, unit: "회" }] },
  { id: "category", title: "차량 카테고리 분포", subtitle: "등록 차량 6대 기준",  type: "donut", color: "#000666", donutData: CATEGORY_DIST },
  { id: "monthly", title: "월별 상담 건수",    subtitle: "서비스 시작 이후 (1월~4월)", type: "bar", color: "#0EA5E9", barData: MONTHLY_CONSULTATION_DATA, summary: [{ label: "이달 합계", value: 6, unit: "건" }, { label: "전월 대비", value: "+1", unit: "건" }, { label: "월 평균", value: 5, unit: "건" }] },
];
const CHART_PER_PAGE = 2;
const CHART_PAGES = Math.ceil(CHARTS.length / CHART_PER_PAGE); // 2

// ─── 하단 데이터 (공용 mock-data.ts 사용) ────────────────
const RECENT_CONSULTATIONS = RECENT_CONSULTATIONS_DASHBOARD;
const TOP_VEHICLES = TOP_VEHICLES_DASHBOARD;
const RECENT_ACTIVITY = RECENT_ADMIN_ACTIVITY.map((a) => ({
  ...a,
  icon: a.isAlert ? AlertCircle : CheckCircle2,
  color: a.isAlert ? "#D97706" : "#059669",
}));

// ─── SVG 차트 컴포넌트 ──────────────────────────────────
function LineChart({ data, color, height = 110 }: { data: LineItem[]; color: string; height?: number }) {
  const W = 500; const H = height;
  const P = { t: 10, r: 8, b: 20, l: 26 };
  const cW = W - P.l - P.r; const cH = H - P.t - P.b;
  const vals = data.map(d => d.value);
  const maxV = Math.max(...vals); const minV = Math.min(...vals); const range = maxV - minV || 1;
  const pts = data.map((d, i) => ({
    x: P.l + (i / (data.length - 1)) * cW,
    y: P.t + cH - ((d.value - minV) / range) * cH, ...d,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const fillD = pathD + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(P.t + cH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(P.t + cH).toFixed(1)} Z`;
  const gid = `lg-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gid})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} stroke="white" strokeWidth="1.5" />
          <text x={p.x} y={H - 2} textAnchor="middle" fontSize="8.5" fill="#9BA4C0">{p.day}</text>
        </g>
      ))}
      <text x={P.l - 3} y={P.t + 4} textAnchor="end" fontSize="8" fill="#C0C5D8">{maxV}</text>
      <text x={P.l - 3} y={P.t + cH + 2} textAnchor="end" fontSize="8" fill="#C0C5D8">{minV}</text>
    </svg>
  );
}

function BarChart({ data, color, height = 100 }: { data: BarItem[]; color: string; height?: number }) {
  const maxV = Math.max(...data.map(d => d.value));
  const bW = 32; const gap = 11; const cH = height - 22;
  const totalW = data.length * (bW + gap) - gap; const H = height;
  return (
    <svg viewBox={`0 0 ${totalW} ${H}`} className="w-full" style={{ height: H }}>
      {data.map((d, i) => {
        const bH = (d.value / maxV) * cH; const x = i * (bW + gap); const y = cH - bH;
        return (
          <g key={i}>
            <rect x={x} y={0} width={bW} height={cH} rx="3" fill={color} fillOpacity="0.06" />
            <rect x={x} y={y} width={bW} height={bH} rx="3" fill={color} fillOpacity={0.2 + (d.value / maxV) * 0.65} />
            <text x={x + bW / 2} y={H} textAnchor="middle" fontSize="8" fill="#9BA4C0">{d.label}</text>
            <text x={x + bW / 2} y={y - 2} textAnchor="middle" fontSize="8" fill={color} fontWeight="600">{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ data }: { data: DonutItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const R = 50; const CX = 62; const CY = 62; const SW = 18;
  const circ = 2 * Math.PI * R;
  const segs = data.reduce<Array<typeof data[number] & { offset: number; dash: number }>>(
    (acc, d) => {
      const cumFrac = acc.reduce((s, x) => s + x.count / total, 0);
      const frac = d.count / total;
      const offset = circ * (1 - cumFrac);
      const dash = circ * frac - 1.5;
      return [...acc, { ...d, offset, dash }];
    },
    []
  );
  return (
    <div className="flex items-center gap-6 w-full h-full">
      <svg width="124" height="124" viewBox="0 0 124 124" className="shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0F2F8" strokeWidth={SW} />
        {segs.map((s, i) => (
          <circle key={i} cx={CX} cy={CY} r={R} fill="none" stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${s.dash} ${circ}`} strokeDashoffset={s.offset}
            transform={`rotate(-90 ${CX} ${CY})`} />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="20" fontWeight="700" fill="#1A1A2E">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="9" fill="#9BA4C0">총 차량</text>
      </svg>
      <div className="flex-1 space-y-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-[12px] text-[#6B7399]">{d.label}</span>
            </div>
            <span className="text-[12px] font-semibold text-[#1A1A2E]">{d.count}대</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 공용 내비게이션 바 ──────────────────────────────────
function NavBar({
  title, total, current, onPrev, onNext, onJump,
}: {
  title: string; total: number; current: number;
  onPrev: () => void; onNext: () => void; onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-2 border-b border-[#F0F2F8]">
      <h2 className="text-[13px] font-semibold text-[#1A1A2E]">{title}</h2>
      <div className="flex items-center gap-2">
        {/* 도트 인디케이터 */}
        <div className="flex items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <button key={i} onClick={() => onJump(i)}
              className={cn("rounded-full transition-all duration-200",
                i === current ? "w-4 h-1.5 bg-[#000666]" : "w-1.5 h-1.5 bg-[#D4D8EC] hover:bg-[#B0B5D0]"
              )} />
          ))}
        </div>
        {/* 화살표 */}
        <button onClick={onPrev} disabled={current === 0}
          className={cn("w-6 h-6 rounded-full flex items-center justify-center border border-[#E8EAF0] bg-white text-[#6B7399] transition-all",
            current === 0 ? "opacity-25 pointer-events-none" : "hover:bg-[#F4F5F8] hover:text-[#1A1A2E]")}>
          <ChevronLeft size={11} />
        </button>
        <button onClick={onNext} disabled={current === total - 1}
          className={cn("w-6 h-6 rounded-full flex items-center justify-center border border-[#E8EAF0] bg-white text-[#6B7399] transition-all",
            current === total - 1 ? "opacity-25 pointer-events-none" : "hover:bg-[#F4F5F8] hover:text-[#1A1A2E]")}>
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

// ─── 슬라이드 애니메이션 variants ────────────────────────
const SLIDE = {
  enter: (d: number) => ({ x: d > 0 ? "55%" : "-55%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? "55%" : "-55%", opacity: 0 }),
};

// ─── 차트 단일 패널 ──────────────────────────────────────
function ChartPanel({ chart }: { chart: ChartDef }) {
  return (
    <div className="flex flex-col">
      {/* 차트 제목 */}
      <div className="mb-3">
        <p className="text-[12px] font-semibold text-[#2A2D4A]">{chart.title}</p>
        <p className="text-[10px] text-[#9BA4C0] mt-0.5">{chart.subtitle}</p>
      </div>
      {/* 차트 본체 */}
      {chart.type === "line" && chart.lineData && <LineChart data={chart.lineData} color={chart.color} />}
      {chart.type === "bar" && chart.barData && <BarChart data={chart.barData} color={chart.color} />}
      {chart.type === "donut" && chart.donutData && (
        <div className="flex items-center" style={{ height: 110 }}>
          <DonutChart data={chart.donutData} />
        </div>
      )}
      {/* 요약 수치 */}
      {chart.summary && (
        <div className="flex gap-4 mt-2 pt-2 border-t border-[#F0F2F8]">
          {chart.summary.map(s => (
            <div key={s.label}>
              <p className="text-[9px] text-[#9BA4C0] leading-none mb-1">{s.label}</p>
              <p className="text-[13px] font-bold text-[#1A1A2E] leading-none">
                {s.value}<span className="text-[10px] font-normal text-[#9BA4C0] ml-0.5">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 페이지 ─────────────────────────────────────────────
export default function AdminDashboard() {
  // 차트 상태
  const [chartPage, setChartPage] = useState(0);
  const [chartDir, setChartDir] = useState(1);
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(true); // 시스템 활성 상태
  
  // 리얼 데이터 상태
  const [realStats, setRealStats] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>(WEEKLY_QUOTE_DATA);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard/stats");
      const json = await res.json();
      if (json.success) {
        setRealStats(json.data.stats);
        if (json.data.weeklyQuoteData?.length > 0) {
          setWeeklyData(json.data.weeklyQuoteData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // 초기 로딩
    setActivities(getActivities());

    // 실시간 업데이트 리스너
    const handleUpdate = () => {
      setActivities(getActivities());
    };
    window.addEventListener("activity_updated", handleUpdate);
    return () => window.removeEventListener("activity_updated", handleUpdate);
  }, []);

  const chartGo = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(CHART_PAGES - 1, chartPage + dir));
    if (next !== chartPage) { setChartDir(dir); setChartPage(next); }
  };
  const chartJump = (i: number) => { if (i !== chartPage) { setChartDir(i > chartPage ? 1 : -1); setChartPage(i); } };

  // 통계 UI 데이터 가공
  const displayStats = [
    { label: "등록 차량",    value: realStats?.totalVehicles ?? DASHBOARD_STATS.totalVehicles, unit: "대", icon: Car,       trend: "+1",   isUp: true,  trendLabel: "전월 대비",  color: "#000666", bg: "#E5E5FA" },
    { label: "노출 중",      value: realStats?.visibleVehicles ?? DASHBOARD_STATS.visibleVehicles, unit: "대", icon: Eye,       trend: "0",   isUp: true, trendLabel: "이번 달",   color: "#059669", bg: "#ECFDF5" },
    { label: "오늘 견적 조회", value: realStats?.todayQuoteViews ?? DASHBOARD_STATS.todayQuoteViews, unit: "회", icon: TrendingUp, trend: "+5%",  isUp: true,  trendLabel: "어제 대비",  color: "#D97706", bg: "#FFFBEB" },
    { label: "AI 추천 세션", value: realStats?.todayAISessions ?? DASHBOARD_STATS.todayAISessions, unit: "회", icon: Sparkles,  trend: "0%", isUp: true,  trendLabel: "어제 대비",  color: "#7C3AED", bg: "#F5F3FF" },
    { label: "이달 신규 상담", value: realStats?.monthlyConsultations ?? DASHBOARD_STATS.monthlyConsultations, unit: "건", icon: Users,     trend: `+${(realStats?.monthlyConsultations ?? 0) - (realStats?.lastMonthConsultations ?? 0)}`, isUp: (realStats?.monthlyConsultations ?? 0) >= (realStats?.lastMonthConsultations ?? 0),  trendLabel: "지난달 대비", color: "#0EA5E9", bg: "#E0F2FE" },
    { label: "계약 전환율",  value: realStats?.conversionRate ?? DASHBOARD_STATS.conversionRate, unit: "%", icon: Percent,   trend: "0%p", isUp: true,  trendLabel: "지난달 대비", color: "#059669", bg: "#ECFDF5" },
  ];

  // 차트 데이터 주입
  const currentCharts = [...CHARTS];
  currentCharts[0] = { ...CHARTS[0], lineData: weeklyData };

  const visibleCharts = currentCharts.slice(chartPage * CHART_PER_PAGE, (chartPage + 1) * CHART_PER_PAGE);

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC] border border-[#E8EAF0] overflow-hidden shadow-sm rounded-[16px]">

      {/* ── 1. 표준 헤더 ────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E8EAF0] px-6 py-3.5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[#F4F5F8] rounded-[8px] text-[#000666]">
            <BarChart2 size={16} />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-[#1A1A2E]">대시보드</h1>
            <p className="text-[11px] text-[#6B7399] mt-0.5">{today} · 실시간 현황 요약</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-2 text-[11px] text-[#9BA4C0] animate-pulse">
              <RefreshCw size={12} className="animate-spin" />
              최신 데이터 동기화 중...
            </div>
          )}
          {/* 시스템 상태 인디케이터 (상태에 따라 색상 및 텍스트 변경) */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border rounded-full shadow-sm transition-all duration-300",
            isSystemActive ? "bg-white border-[#E8EAF0]" : "bg-red-50 border-red-200"
          )}>
            <div className="relative flex h-2 w-2">
              <span className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                isSystemActive ? "bg-emerald-400" : "bg-red-400"
              )}></span>
              <span className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                isSystemActive ? "bg-emerald-500" : "bg-red-500"
              )}></span>
            </div>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider",
              isSystemActive ? "text-[#4A5270]" : "text-red-600"
            )}>
              {isSystemActive ? "시스템 상시 활성" : "시스템 점검 중"}
            </span>
            
            {/* 데모용 토글 버튼 (실제 운영시에는 자동 감지) */}
            <button 
              onClick={() => setIsSystemActive(!isSystemActive)}
              className="ml-1 p-0.5 hover:bg-[#F4F5F8] rounded-full text-[#9BA4C0] transition-colors"
              title="시스템 상태 토글 (데모)"
            >
              <Settings size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* 내부 스크롤 영역 */}
      <div className="flex-1 overflow-auto p-5 flex flex-col gap-4 scrollbar-hide">
        {/* ── 2. KPI 6개 ───────────────────────── */}
        <div className="grid grid-cols-6 gap-4">
          {displayStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label}
                className="bg-white rounded-[12px] border border-[#E8EAF0] px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-[#6B7399] truncate pr-1">{stat.label}</p>
                  <span className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0"
                    style={{ background: stat.bg }}>
                    <Icon size={12} style={{ color: stat.color }} strokeWidth={2.5} />
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-[21px] font-bold text-[#1A1A2E] leading-none">{stat.value}</span>
                  <span className="text-[10px] text-[#9BA4C0] font-medium">{stat.unit}</span>
                </div>
                <p className="text-[9px] text-[#9BA4C0] mt-1.5">
                  <span className={cn("font-bold px-1.5 py-0.5 rounded-[4px] mr-1", stat.isUp ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                    {stat.trend}
                  </span>
                  {stat.trendLabel}
                </p>
              </div>
            );
          })}
        </div>

        {/* ── 3. 차트 캐러셀 ────────── */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm">
          <NavBar
            title="분석 차트"
            total={CHART_PAGES}
            current={chartPage}
            onPrev={() => chartGo(-1)}
            onNext={() => chartGo(1)}
            onJump={chartJump}
          />
          <div className="px-5 py-4 overflow-hidden touch-none cursor-grab active:cursor-grabbing">
            <AnimatePresence mode="wait" custom={chartDir}>
              <motion.div
                key={chartPage}
                custom={chartDir}
                variants={SLIDE}
                initial="enter" animate="center" exit="exit"
                transition={{ duration: 0.24, ease: "easeOut" }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  const swipe = info.offset.x;
                  if (swipe > 50) chartGo(-1);
                  else if (swipe < -50) chartGo(1);
                }}
                className="grid grid-cols-2 gap-8"
              >
                {visibleCharts.map((chart) => (
                  <ChartPanel key={chart.id} chart={chart} />
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ── 4. 하단 4열 (Edge-to-Edge 정제) ─────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">

          {/* ① 최근 상담 */}
          <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm overflow-hidden relative group/list flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F0F2F8]">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={13} strokeWidth={2.5} className="text-[#000666]" />
                <h2 className="text-[13px] font-bold text-[#1A1A2E]">최근 상담</h2>
              </div>
              <Link href="/admin/quotations" className="flex items-center gap-0.5 text-[11px] font-bold text-[#000666] hover:opacity-70 transition-opacity">
                전체 <ChevronRight size={10} />
              </Link>
            </div>
            <div className="flex-1 max-h-[325px] overflow-y-auto divide-y divide-[#F8F9FC] relative scrollbar-hide">
              {(realStats?.recentQuotes || RECENT_CONSULTATIONS).map((c: any) => {
                // 상태별 컬러 매핑 (StatusMap이 있으면 좋지만 일단 수동으로)
                const statusColors: any = {
                  'NEW': { b: '#E5E5FA', c: '#000666', l: '신규' },
                  'CONTACTED': { b: '#E0F2FE', c: '#0EA5E9', l: '상담중' },
                  'CONVERTED': { b: '#ECFDF5', c: '#059669', l: '계약완료' },
                };
                const s = statusColors[c.status] || { b: '#F4F5F8', c: '#9BA4C0', l: c.status };
                
                return (
                  <Link key={c.id} href={`/admin/quotations?id=${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8F9FC] transition-colors">
                    <div className="w-6 h-6 rounded-full bg-[#E5E5FA] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[#000666]">{c.name?.[0] || 'G'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#1A1A2E] truncate">{c.name} · {c.vehicle}</p>
                      <p className="flex items-center gap-1 text-[10px] text-[#9BA4C0] mt-0.5">
                        <Clock size={8} /> {typeof c.time === 'string' ? c.time : new Date(c.time).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] shrink-0"
                      style={{ color: s.c, background: s.b }}>{s.l}</span>
                  </Link>
                );
              })}
              <div className="h-10 shrink-0" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10 opacity-90" />
          </div>

          {/* ② 인기 차량 */}
          <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F0F2F8]">
              <div className="flex items-center gap-1.5">
                <BarChart2 size={13} strokeWidth={2.5} className="text-[#000666]" />
                <h2 className="text-[13px] font-bold text-[#1A1A2E]">인기 차량</h2>
              </div>
              <Link href="/admin/vehicles" className="flex items-center gap-0.5 text-[11px] font-bold text-[#000666] hover:opacity-70 transition-opacity">
                전체 <ChevronRight size={10} />
              </Link>
            </div>
            <div className="flex-1 p-0 divide-y divide-[#F8F9FC]">
              {TOP_VEHICLES.slice(0, 5).map(v => (
                <div key={v.rank} className="px-4 py-3 hover:bg-[#FAFBFF] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-5 h-5 rounded-[4px] flex items-center justify-center text-[10px] font-black shrink-0",
                        v.rank === 1 ? "bg-amber-100 text-amber-600" : v.rank === 2 ? "bg-slate-100 text-slate-500" : v.rank === 3 ? "bg-orange-100 text-orange-600" : "bg-[#F4F5F8] text-[#9BA4C0]")}>
                        {v.rank}
                      </span>
                      <span className="text-[12px] font-bold text-[#1A1A2E] truncate">{v.name}</span>
                    </div>
                    <span className="flex items-center gap-0.5 text-[11px] font-bold text-[#000666] ml-1 shrink-0">
                      <Star size={10} fill="currentColor" /> {v.views.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#F0F2F8] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${v.bar}%` }}
                      transition={{ duration: 0.6, delay: 0.3 + v.rank * 0.06, ease: "easeOut" }}
                      className="h-full rounded-full" style={{ background: v.barColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ③ 빠른 액션 */}
          <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#F0F2F8]">
              <h2 className="text-[13px] font-bold text-[#1A1A2E]">빠른 액션</h2>
            </div>
            <div className="flex flex-col gap-2 p-3">
              {[
                { href: "/admin/vehicles", label: "차량 관리", icon: Plus },
                { href: "/admin/quotations", label: "견적 데이터 확인", icon: BarChart2 },
                { href: "/admin/users", label: "사용자 관리", icon: Users },
                { href: "/admin/memo", label: "운영 메모", icon: TrendingUp },
              ].map(action => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href}
                    className="flex items-center gap-3 px-4 py-3 rounded-[10px] text-[12px] font-bold w-full bg-[#E5E5FA] text-[#000666] hover:bg-[#D4D4F5] transition-all duration-150 shadow-sm border border-[#C0C5DC]/30">
                    <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center shrink-0">
                       <Icon size={13} strokeWidth={2.5} />
                    </div>
                    {action.label}
                  </Link>
                );
              })}
              
              {/* 추가된 기능형 빠른 액션: 실시간 데이터 동기화 */}
              <button
                onClick={() => {
                  if (syncing) return;
                  setSyncing(true);
                  logActivity("관리자가 '실시간 데이터 동기화'를 실행했습니다.", "update");
                  setTimeout(() => {
                    setSyncing(false);
                    // 전역 캐시 무효화나 데이터 재요청 로직이 있다면 여기서 수행
                    window.dispatchEvent(new Event("activity_updated"));
                  }, 1500);
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[10px] text-[12px] font-bold w-full transition-all duration-300 shadow-sm border",
                  syncing 
                    ? "bg-[#F4F5F8] text-[#9BA4C0] border-[#E8EAF0] cursor-not-allowed" 
                    : "bg-[#E5E5FA] text-[#000666] border-[#C0C5DC]/30 hover:bg-[#D4D4F5] hover:scale-[1.02] active:scale-[0.98]"
                )}
              >
                <div className={cn("w-6 h-6 rounded-full bg-white/50 flex items-center justify-center shrink-0", syncing && "animate-spin")}>
                   <RefreshCw size={13} strokeWidth={2.5} />
                </div>
                {syncing ? "데이터 동기화 중..." : "실시간 데이터 동기화"}
              </button>
            </div>
          </div>

          {/* ④ 최근 활동 */}
          <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm overflow-hidden relative group/list flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#F0F2F8]">
              <h2 className="text-[13px] font-bold text-[#1A1A2E]">최근 활동</h2>
            </div>
            <div className="flex-1 flex flex-col gap-0 divide-y divide-[#F8F9FC] max-h-[325px] overflow-y-auto scrollbar-hide">
              <div className="flex flex-col gap-0">
                {activities.length > 0 ? activities.map(act => (
                  <div key={act.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#FAFBFF] transition-colors">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: act.color + "1A" }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: act.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#3D4470] leading-snug font-bold">{act.text}</p>
                      <p className="text-[10px] font-medium text-[#9BA4C0] mt-1.5 flex items-center gap-1">
                        <Clock size={8} /> {act.time}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 opacity-40">
                    <RefreshCw size={24} className="text-[#9BA4C0] mb-2 animate-spin-slow" />
                    <p className="text-[11px] text-[#9BA4C0]">현재 기록된 활동이 없습니다</p>
                  </div>
                )}
              </div>
              <div className="h-10 shrink-0" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-10 opacity-90" />
          </div>

        </div>
      </div>
    </div>
  );
}
