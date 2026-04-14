"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Eye, TrendingUp, Sparkles, ChevronLeft, ChevronRight,
  Plus, AlertCircle, CheckCircle2, MessageSquare, Clock, Star,
  BarChart2, Percent, Users, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── KPI 6개 (한번에 전체 표시) ─────────────────────────
const STATS = [
  { label: "등록 차량", value: 12, unit: "대", icon: Car, trend: "+2", isUp: true, trendLabel: "이번 달", color: "#000666", bg: "#E5E5FA" },
  { label: "노출 중", value: 8, unit: "대", icon: Eye, trend: "-1", isUp: false, trendLabel: "어제 대비", color: "#059669", bg: "#ECFDF5" },
  { label: "오늘 견적 조회", value: 47, unit: "회", icon: TrendingUp, trend: "+12%", isUp: true, trendLabel: "어제 대비", color: "#D97706", bg: "#FFFBEB" },
  { label: "AI 추천 세션", value: 23, unit: "회", icon: Sparkles, trend: "+8%", isUp: true, trendLabel: "어제 대비", color: "#7C3AED", bg: "#F5F3FF" },
  { label: "이달 신규 상담", value: 89, unit: "건", icon: Users, trend: "+15%", isUp: true, trendLabel: "지난달 대비", color: "#0EA5E9", bg: "#E0F2FE" },
  { label: "계약 전환율", value: 34, unit: "%", icon: Percent, trend: "+2%p", isUp: true, trendLabel: "지난달 대비", color: "#059669", bg: "#ECFDF5" },
];

// ─── 차트 데이터 ─────────────────────────────────────────
const WEEKLY_QUOTES = [{ day: "월", value: 31 }, { day: "화", value: 28 }, { day: "수", value: 42 }, { day: "목", value: 38 }, { day: "금", value: 55 }, { day: "토", value: 22 }, { day: "일", value: 47 }];
const WEEKLY_AI = [{ day: "월", value: 15 }, { day: "화", value: 18 }, { day: "수", value: 21 }, { day: "목", value: 19 }, { day: "금", value: 27 }, { day: "토", value: 10 }, { day: "일", value: 23 }];
const MONTHLY_CONS = [{ label: "10월", value: 52 }, { label: "11월", value: 68 }, { label: "12월", value: 71 }, { label: "1월", value: 58 }, { label: "2월", value: 63 }, { label: "3월", value: 79 }, { label: "4월", value: 89 }];
const CATEGORY_DATA = [{ label: "세단", count: 4, color: "#000666" }, { label: "SUV", count: 3, color: "#7C3AED" }, { label: "밴", count: 1, color: "#D97706" }, { label: "EV", count: 2, color: "#059669" }, { label: "하이브리드", count: 2, color: "#0EA5E9" }];

type LineItem = { day: string; value: number };
type BarItem = { label: string; value: number };
type DonutItem = { label: string; count: number; color: string };
interface ChartDef {
  id: string; title: string; subtitle: string; type: "line" | "bar" | "donut"; color: string;
  lineData?: LineItem[]; barData?: BarItem[]; donutData?: DonutItem[];
  summary?: { label: string; value: number | string; unit: string }[];
}

const CHARTS: ChartDef[] = [
  { id: "quotes", title: "주간 견적 조회 추이", subtitle: "최근 7일", type: "line", color: "#D97706", lineData: WEEKLY_QUOTES, summary: [{ label: "주간 합계", value: 263, unit: "회" }, { label: "일 평균", value: 38, unit: "회" }, { label: "최고치", value: 55, unit: "회" }] },
  { id: "ai", title: "주간 AI 추천 세션", subtitle: "최근 7일", type: "line", color: "#7C3AED", lineData: WEEKLY_AI, summary: [{ label: "주간 합계", value: 133, unit: "회" }, { label: "일 평균", value: 19, unit: "회" }, { label: "최고치", value: 27, unit: "회" }] },
  { id: "category", title: "차량 카테고리 분포", subtitle: "등록 차량 기준", type: "donut", color: "#000666", donutData: CATEGORY_DATA },
  { id: "monthly", title: "월별 상담 건수", subtitle: "최근 7개월", type: "bar", color: "#0EA5E9", barData: MONTHLY_CONS, summary: [{ label: "이달 합계", value: 89, unit: "건" }, { label: "전월 대비", value: "+13", unit: "건" }, { label: "7개월 평균", value: 69, unit: "건" }] },
];
const CHART_PER_PAGE = 2;
const CHART_PAGES = Math.ceil(CHARTS.length / CHART_PER_PAGE); // 2

// ─── 하단 목 데이터 ──────────────────────────────────────
const RECENT_CONSULTATIONS = [
  { id: "c1", name: "김민준", vehicle: "아이오닉 6", time: "방금 전", status: "진행중", sc: "#000666", sb: "#E5E5FA" },
  { id: "c2", name: "이서연", vehicle: "기아 EV6", time: "12분 전", status: "견적완료", sc: "#059669", sb: "#ECFDF5" },
  { id: "c3", name: "박도현", vehicle: "GV80", time: "34분 전", status: "이탈", sc: "#9BA4C0", sb: "#F4F5F8" },
  { id: "c4", name: "최지우", vehicle: "투싼", time: "1시간 전", status: "견적완료", sc: "#059669", sb: "#ECFDF5" },
];
const TOP_VEHICLES = [
  { rank: 1, name: "현대 아이오닉 6", views: 312, bar: 100, barColor: "#000666" },
  { rank: 2, name: "기아 EV6", views: 278, bar: 89, barColor: "#7C3AED" },
  { rank: 3, name: "현대 투싼", views: 241, bar: 77, barColor: "#D97706" },
  { rank: 4, name: "제네시스 GV80", views: 189, bar: 61, barColor: "#9BA4C0" },
];
const RECENT_ACTIVITY = [
  { id: 1, text: "아이오닉6 기준가 업데이트", time: "10분 전", icon: CheckCircle2, color: "#059669" },
  { id: 2, text: "투싼 비노출 처리", time: "1시간 전", icon: AlertCircle, color: "#D97706" },
  { id: 3, text: "K8 신규 등록 완료", time: "3시간 전", icon: CheckCircle2, color: "#059669" },
  { id: 4, text: "금융사 회수율 업데이트", time: "어제", icon: CheckCircle2, color: "#059669" },
];

// ─── SVG 차트 컴포넌트 ──────────────────────────────────
function LineChart({ data, color, height = 130 }: { data: LineItem[]; color: string; height?: number }) {
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

function BarChart({ data, color, height = 120 }: { data: BarItem[]; color: string; height?: number }) {
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
  let cum = 0;
  const segs = data.map(d => {
    const frac = d.count / total;
    const offset = circ * (1 - cum); const dash = circ * frac - 1.5;
    cum += frac;
    return { ...d, offset, dash };
  });
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
    <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F2F8]">
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
        <p className="text-[13px] font-semibold text-[#2A2D4A]">{chart.title}</p>
        <p className="text-[11px] text-[#9BA4C0] mt-0.5">{chart.subtitle}</p>
      </div>
      {/* 차트 본체 */}
      {chart.type === "line" && chart.lineData && <LineChart data={chart.lineData} color={chart.color} />}
      {chart.type === "bar" && chart.barData && <BarChart data={chart.barData} color={chart.color} />}
      {chart.type === "donut" && chart.donutData && (
        <div className="flex items-center" style={{ height: 130 }}>
          <DonutChart data={chart.donutData} />
        </div>
      )}
      {/* 요약 수치 */}
      {chart.summary && (
        <div className="flex gap-6 mt-3 pt-3 border-t border-[#F0F2F8]">
          {chart.summary.map(s => (
            <div key={s.label}>
              <p className="text-[10px] text-[#9BA4C0] leading-none mb-1">{s.label}</p>
              <p className="text-[15px] font-bold text-[#1A1A2E] leading-none">
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

  const chartGo = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(CHART_PAGES - 1, chartPage + dir));
    if (next !== chartPage) { setChartDir(dir); setChartPage(next); }
  };
  const chartJump = (i: number) => { if (i !== chartPage) { setChartDir(i > chartPage ? 1 : -1); setChartPage(i); } };

  const visibleCharts = CHARTS.slice(chartPage * CHART_PER_PAGE, (chartPage + 1) * CHART_PER_PAGE);

  const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="p-5 flex flex-col gap-3.5" style={{ minHeight: "100vh" }}>

      {/* ── 헤더 ────────────────────────────────────── */}
      <div>
        <p className="text-[11px] text-[#8890AA]">{today}</p>
        <h1 className="text-[20px] font-semibold text-[#1A1A2E] leading-tight">대시보드</h1>
      </div>

      {/* ── KPI 6개 한번에 표시 ───────────────────────── */}
      <div className="grid grid-cols-6 gap-3">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label}
              className="bg-white rounded-[12px] border border-[#E8EAF0] px-4 py-3.5"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-medium text-[#6B7399] truncate pr-1">{stat.label}</p>
                <span className="w-6 h-6 rounded-[5px] flex items-center justify-center shrink-0"
                  style={{ background: stat.bg }}>
                  <Icon size={12} style={{ color: stat.color }} strokeWidth={2} />
                </span>
              </div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[22px] font-bold text-[#1A1A2E] leading-none">{stat.value}</span>
                <span className="text-[11px] text-[#9BA4C0] ml-0.5">{stat.unit}</span>
              </div>
              <p className="text-[10px] text-[#9BA4C0] mt-1.5">
                <span className={cn("font-semibold", stat.isUp ? "text-emerald-600" : "text-amber-600")}>
                  {stat.trend}
                </span>{" "}{stat.trendLabel}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── 차트 캐러셀 (2개씩 · 가장 크게) ──────────… */}
      <div className="bg-white rounded-[12px] border border-[#E8EAF0]"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <NavBar
          title="분석 차트"
          total={CHART_PAGES}
          current={chartPage}
          onPrev={() => chartGo(-1)}
          onNext={() => chartGo(1)}
          onJump={chartJump}
        />
        <div className="px-5 py-4 overflow-hidden">
          <AnimatePresence mode="wait" custom={chartDir}>
            <motion.div
              key={chartPage}
              custom={chartDir}
              variants={SLIDE}
              initial="enter" animate="center" exit="exit"
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="grid grid-cols-2 gap-8"
            >
              {visibleCharts.map((chart) => (
                <ChartPanel key={chart.id} chart={chart} />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── 하단 4열 (컴팩트) ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-3.5">

        {/* ① 최근 상담 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F0F2F8]">
            <div className="flex items-center gap-1.5">
              <MessageSquare size={11} className="text-[#6B7399]" strokeWidth={2} />
              <h2 className="text-[11px] font-semibold text-[#1A1A2E]">최근 상담</h2>
            </div>
            <Link href="/admin/logs" className="flex items-center gap-0.5 text-[10px] text-[#000666] hover:opacity-70 transition-opacity">
              전체 <ChevronRight size={9} />
            </Link>
          </div>
          <div className="divide-y divide-[#F8F9FC]">
            {RECENT_CONSULTATIONS.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3.5 py-2 hover:bg-[#FAFBFF] transition-colors">
                <div className="w-5 h-5 rounded-full bg-[#E5E5FA] flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-[#000666]">{c.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-[#1A1A2E] truncate">{c.name} · {c.vehicle}</p>
                  <p className="flex items-center gap-0.5 text-[9px] text-[#B0B5CC]">
                    <Clock size={7} /> {c.time}
                  </p>
                </div>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-[3px] shrink-0"
                  style={{ color: c.sc, background: c.sb }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ② 인기 차량 Top 4 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#F0F2F8]">
            <div className="flex items-center gap-1.5">
              <BarChart2 size={11} className="text-[#6B7399]" strokeWidth={2} />
              <h2 className="text-[11px] font-semibold text-[#1A1A2E]">인기 차량</h2>
            </div>
            <Link href="/admin/vehicles" className="flex items-center gap-0.5 text-[10px] text-[#000666] hover:opacity-70 transition-opacity">
              전체 <ChevronRight size={9} />
            </Link>
          </div>
          <div className="px-3.5 py-2.5 space-y-2.5">
            {TOP_VEHICLES.map(v => (
              <div key={v.rank}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn("w-4 h-4 rounded-[3px] flex items-center justify-center text-[8px] font-bold shrink-0",
                      v.rank === 1 ? "bg-[#FEF3C7] text-[#D97706]" : v.rank === 2 ? "bg-[#F0F2F8] text-[#6B7399]" : v.rank === 3 ? "bg-[#FDE8D4] text-[#C05621]" : "bg-[#F4F5F8] text-[#9BA4C0]")}>
                      {v.rank}
                    </span>
                    <span className="text-[10px] text-[#1A1A2E] truncate">{v.name}</span>
                  </div>
                  <span className="flex items-center gap-0.5 text-[9px] text-[#9BA4C0] ml-1 shrink-0">
                    <Star size={7} /> {v.views}
                  </span>
                </div>
                <div className="h-1 bg-[#F0F2F8] rounded-full overflow-hidden">
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

        {/* ③ 빠른 액션 — 1열 동일 너비 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="px-3.5 py-2.5 border-b border-[#F0F2F8]">
            <h2 className="text-[11px] font-semibold text-[#1A1A2E]">빠른 액션</h2>
          </div>
          <div className="flex flex-col gap-1.5 p-2.5">
            {[
              { href: "/admin/vehicles?action=add", label: "차량 추가", icon: Plus, primary: true },
              { href: "/admin/rates", label: "회수율 수정", icon: TrendingUp, primary: false },
              { href: "/admin/finance", label: "금융사 관리", icon: CreditCard, primary: false },
              { href: "/admin/logs", label: "추천 로그 확인", icon: Sparkles, primary: false },
            ].map(action => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-[8px] text-[11px] font-medium w-full transition-all duration-150",
                    action.primary
                      ? "bg-[#000666] text-white hover:opacity-90"
                      : "bg-[#F4F5F8] text-[#4A5270] hover:bg-[#EAEDF5] hover:text-[#1A1A2E]"
                  )}>
                  <Icon size={12} strokeWidth={2} />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ④ 최근 활동 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div className="px-3.5 py-2.5 border-b border-[#F0F2F8]">
            <h2 className="text-[11px] font-semibold text-[#1A1A2E]">최근 활동</h2>
          </div>
          <div className="flex flex-col gap-0 divide-y divide-[#F8F9FC]">
            {RECENT_ACTIVITY.map(act => {
              const Icon = act.icon;
              return (
                <div key={act.id} className="flex items-start gap-2 px-3.5 py-2">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: act.color + "1A" }}>
                    <Icon size={9} style={{ color: act.color }} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#3D4470] leading-snug">{act.text}</p>
                    <p className="text-[9px] text-[#9BA4C0]">{act.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
