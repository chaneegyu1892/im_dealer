"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Car, Eye, TrendingUp, Sparkles, Users, ChevronLeft, ChevronRight,
  Plus, CheckCircle2, AlertCircle, BarChart2, Star, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart } from "./charts/LineChart";
import { BarChart } from "./charts/BarChart";
import { DonutChart } from "./charts/DonutChart";
import type { DashboardData } from "@/types/admin";

// ─── KPI 아이콘 매핑 ────────────────────────────────────
const STAT_CONFIG = [
  { key: "totalVehicles", label: "등록 차량", unit: "대", icon: Car, color: "#000666", bg: "#E5E5FA" },
  { key: "visibleVehicles", label: "노출 중", unit: "대", icon: Eye, color: "#059669", bg: "#ECFDF5" },
  { key: "todayQuoteViews", label: "오늘 견적 조회", unit: "회", icon: TrendingUp, color: "#D97706", bg: "#FFFBEB" },
  { key: "todayAiSessions", label: "AI 추천 세션", unit: "회", icon: Sparkles, color: "#7C3AED", bg: "#F5F3FF" },
  { key: "monthlyQuotes", label: "이달 저장 견적", unit: "건", icon: Users, color: "#0EA5E9", bg: "#E0F2FE" },
] as const;

const ACTIVITY_ICONS: Record<string, typeof CheckCircle2> = {
  update: CheckCircle2,
  info: AlertCircle,
};

// ─── Props ──────────────────────────────────────────────
interface DashboardClientProps {
  data: DashboardData;
}

export function DashboardClient({ data }: DashboardClientProps) {
  const [chartPage, setChartPage] = useState(0);

  const charts = [
    {
      id: "quotes",
      title: "주간 견적 조회 추이",
      subtitle: "최근 7일",
      render: () => <LineChart data={data.weeklyQuoteViews} color="#D97706" />,
    },
    {
      id: "ai",
      title: "주간 AI 추천 세션",
      subtitle: "최근 7일",
      render: () => <LineChart data={data.weeklyAiSessions} color="#7C3AED" />,
    },
    {
      id: "category",
      title: "차량 카테고리 분포",
      subtitle: "등록 차량 기준",
      render: () => <DonutChart data={data.categoryDistribution} />,
    },
    {
      id: "monthly",
      title: "월별 저장 견적",
      subtitle: "최근 추이",
      render: () => (
        <BarChart
          data={data.monthlySavedQuotes.map((m) => ({ label: m.month.slice(5), value: m.count }))}
          color="#0EA5E9"
        />
      ),
    },
  ];

  const chartsPerPage = 2;
  const totalPages = Math.ceil(charts.length / chartsPerPage);
  const visibleCharts = charts.slice(chartPage * chartsPerPage, (chartPage + 1) * chartsPerPage);

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  return (
    <div className="p-5 space-y-5">
      {/* 헤더 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#1A1A2E]">대시보드</h1>
          <p className="text-[13px] text-[#9BA4C0] mt-0.5">{today}</p>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-5 gap-4">
        {STAT_CONFIG.map((cfg) => {
          const Icon = cfg.icon;
          const value = data.stats[cfg.key as keyof typeof data.stats];
          return (
            <div key={cfg.key} className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ background: cfg.bg }}>
                  <Icon size={16} style={{ color: cfg.color }} />
                </div>
                <span className="text-[11px] text-[#6B7399] font-medium">{cfg.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold text-[#1A1A2E] leading-none">{value}</span>
                <span className="text-[12px] text-[#9BA4C0]">{cfg.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 차트 섹션 */}
      <div className="bg-white rounded-[14px] border border-[#E8EAF0] overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F2F8]">
          <h2 className="text-[13px] font-semibold text-[#1A1A2E]">데이터 현황</h2>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} onClick={() => setChartPage(i)} className={cn(
                "w-2 h-2 rounded-full transition-colors",
                i === chartPage ? "bg-[#000666]" : "bg-[#D0D5E8]"
              )} />
            ))}
            <button onClick={() => setChartPage((p) => Math.max(0, p - 1))} disabled={chartPage === 0} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F0F2F8] text-[#9BA4C0] disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setChartPage((p) => Math.min(totalPages - 1, p + 1))} disabled={chartPage === totalPages - 1} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F0F2F8] text-[#9BA4C0] disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-[#F0F2F8]">
          {visibleCharts.map((chart) => (
            <div key={chart.id} className="p-5">
              <p className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5">{chart.title}</p>
              <p className="text-[11px] text-[#9BA4C0] mb-4">{chart.subtitle}</p>
              {chart.render()}
            </div>
          ))}
        </div>
      </div>

      {/* 하단 4열 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 인기 차량 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3 flex items-center gap-1.5">
            <Star size={14} className="text-[#D97706]" /> 인기 차량
          </h3>
          <div className="space-y-2.5">
            {data.topVehicles.length === 0 ? (
              <p className="text-[12px] text-[#9BA4C0]">데이터 없음</p>
            ) : (
              data.topVehicles.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-[#F4F5F8] text-[10px] font-bold text-[#6B7399]">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#1A1A2E] truncate">{v.name}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-[#F0F2F8] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(v.views / (data.topVehicles[0]?.views || 1)) * 100}%`,
                          background: ["#000666", "#7C3AED", "#D97706", "#9BA4C0", "#0EA5E9"][i] ?? "#9BA4C0",
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-[#6B7399] shrink-0">{v.views}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 빠른 액션 */}
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3 flex items-center gap-1.5">
            <BarChart2 size={14} className="text-[#000666]" /> 빠른 액션
          </h3>
          <div className="space-y-2">
            {[
              { label: "차량 관리", href: "/admin/vehicles", icon: Car },
              { label: "견적 데이터", href: "/admin/quotations", icon: TrendingUp },
              { label: "데이터 분석", href: "/admin/analytics", icon: BarChart2 },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] border border-[#E8EAF0] hover:border-[#000666] hover:bg-[#FAFBFF] transition-colors text-[12px] font-medium text-[#4A5270] hover:text-[#000666]"
              >
                <action.icon size={14} /> {action.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 최근 활동 */}
        <div className="col-span-2 bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
          <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3 flex items-center gap-1.5">
            <Clock size={14} className="text-[#059669]" /> 최근 활동
          </h3>
          <div className="space-y-2">
            {data.recentActivity.length === 0 ? (
              <p className="text-[12px] text-[#9BA4C0]">최근 활동이 없습니다</p>
            ) : (
              data.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-2.5 py-1.5">
                  <CheckCircle2 size={14} className="text-[#059669] shrink-0" />
                  <span className="text-[12px] text-[#1A1A2E] flex-1 truncate">{a.text}</span>
                  <span className="text-[11px] text-[#9BA4C0] shrink-0">{a.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
