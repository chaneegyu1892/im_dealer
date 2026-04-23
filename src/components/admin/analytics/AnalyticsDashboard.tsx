"use client";

import { motion } from "framer-motion";
import {
  TrendingUp, BarChart2, FileText, ArrowUpRight, Users, type LucideIcon,
} from "lucide-react";
import type { AnalyticsData } from "@/types/admin";
import { formatKRWCount } from "@/lib/format";

const COLORS = ["#000666", "#2A2A72", "#4B4B99", "#6C6CBF", "#8E8EE6"];
const ENGINE_COLORS: Record<string, string> = {
  hybrid: "#000666",
  gasoline: "#6066EE",
  diesel: "#4B4B99",
  electric: "#B0B5D0",
  hydrogen: "#059669",
};

interface AnalyticsDashboardProps {
  data: AnalyticsData;
}

export function AnalyticsDashboard({ data }: AnalyticsDashboardProps) {
  const {
    totalQuoteViews,
    totalVisitors,
    dailyTrend,
    vehicleLeaderboard,
    engineTypeDistribution,
  } = data;

  const conversionRate =
    totalVisitors > 0
      ? ((totalQuoteViews / totalVisitors) * 100).toFixed(1)
      : "0.0";

  // SVG 라인 차트 계산
  const trendValues = dailyTrend.map((d) => d.count);
  const maxTrend = Math.max(...trendValues, 1);
  const minTrend = Math.min(...trendValues, 0);
  const W = 1000;
  const H = 300;

  const getLinePath = () => {
    const points = trendValues.map((val, i) => {
      const x = trendValues.length > 1 ? (i / (trendValues.length - 1)) * W : W / 2;
      const range = maxTrend - minTrend * 0.8 || 1;
      const y = H - ((val - minTrend * 0.8) / range) * H;
      return `${x},${Math.max(0, Math.min(H, y))}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const getAreaPath = () => `${getLinePath()} L ${W},${H} L 0,${H} Z`;

  // 파워트레인 도넛 계산
  const totalEngine = engineTypeDistribution.reduce((s, e) => s + e.count, 0) || 1;
  const engineWithPercent = engineTypeDistribution.map((e) => ({
    ...e,
    percent: Math.round((e.count / totalEngine) * 100),
    color: ENGINE_COLORS[e.engineType] ?? "#9BA4C0",
    label: ENGINE_TYPE_LABELS[e.engineType] ?? e.engineType,
  }));

  // 리더보드 top 5
  const leaderboard = vehicleLeaderboard.slice(0, 5);
  const maxCount = leaderboard[0]?.count || 1;

  return (
    <div
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
            <h1 className="text-[16px] font-bold text-[#1A1A2E]">데이터 분석</h1>
            <p className="text-[11px] font-medium text-[#6B7399] mt-0.5">
              차량별 견적 발생량 및 방문자 트렌드 통계 (최근 30일)
            </p>
          </div>
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1 p-5 min-h-0 flex flex-col gap-5">
        {/* KPI 행 */}
        <div className="flex gap-4 shrink-0">
          <KPICard
            title="총 견적 조회"
            value={formatKRWCount(totalQuoteViews)}
            unit="건"
            icon={FileText}
          />
          <KPICard
            title="고유 방문 세션"
            value={formatKRWCount(totalVisitors)}
            unit="명"
            icon={Users}
          />
          <KPICard
            title="견적 전환율"
            value={conversionRate}
            unit="%"
            icon={TrendingUp}
          />
        </div>

        {/* 메인 차트 + 사이드 패널 */}
        <div className="flex-1 min-h-0 flex gap-5">
          {/* 일간 트렌드 */}
          <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-6 flex flex-col flex-1 shadow-sm min-w-0">
            <div className="flex items-center justify-between shrink-0 mb-6">
              <div>
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">일간 견적 조회 트렌드</h2>
                <p className="text-[11px] text-[#6B7399] mt-1">지난 30일간의 서비스 사용 추이</p>
              </div>
              <span className="text-[20px] font-bold text-[#000666]">
                Total {formatKRWCount(totalQuoteViews)}
              </span>
            </div>
            <div className="flex-1 relative min-h-0">
              {trendValues.every((v) => v === 0) ? (
                <div className="flex items-center justify-center h-full text-[12px] text-[#9BA4C0]">
                  데이터 없음
                </div>
              ) : (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  preserveAspectRatio="none"
                  className="w-full h-full overflow-visible"
                >
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#000666" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#000666" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <motion.path
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 1 }}
                    d={getAreaPath()}
                    fill="url(#trendGrad)"
                  />
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    d={getLinePath()}
                    fill="none"
                    stroke="#000666"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {trendValues.map((val, i) => {
                    if (i % 5 !== 0 && i !== trendValues.length - 1) return null;
                    const len = trendValues.length;
                    const x = len > 1 ? (i / (len - 1)) * W : W / 2;
                    const range = maxTrend - minTrend * 0.8 || 1;
                    const y = H - ((val - minTrend * 0.8) / range) * H;
                    return (
                      <motion.circle
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1 + i * 0.02 }}
                        cx={x}
                        cy={Math.max(0, Math.min(H, y))}
                        r="6"
                        fill="white"
                        stroke="#000666"
                        strokeWidth="3"
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </section>

          {/* 사이드: 리더보드 + 파워트레인 */}
          <div className="flex flex-col gap-5 w-[400px] shrink-0">
            {/* 차량별 순위 */}
            <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex flex-col flex-[1.4] shadow-sm min-h-0 overflow-hidden">
              <div className="shrink-0 mb-4">
                <h2 className="text-[14px] font-bold text-[#1A1A2E]">차량별 견적 조회 순위</h2>
                <p className="text-[11px] text-[#6B7399] mt-0.5">상위 5개 모델 랭킹</p>
              </div>
              {leaderboard.length === 0 ? (
                <p className="text-[12px] text-[#9BA4C0]">데이터 없음</p>
              ) : (
                <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-2">
                  {leaderboard.map((item, idx) => {
                    const percent = (item.count / maxCount) * 100;
                    return (
                      <div key={item.vehicleId} className="flex flex-col gap-1.5 mb-3 last:mb-0">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-bold text-[#1A1A2E] flex items-center gap-2">
                            <span className="text-[11px] font-black text-[#9BA4C0] w-4">
                              {idx + 1}
                            </span>
                            {item.name}
                          </span>
                          <span className="font-bold text-[#000666]">
                            {item.count.toLocaleString()}건
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[#F0F2F8] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: idx * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 파워트레인 분포 */}
            <section className="bg-white rounded-[10px] border border-[#E8EAF0] p-5 flex items-center flex-[1] shadow-sm min-h-0">
              <div className="flex-1">
                <h2 className="text-[14px] font-bold text-[#1A1A2E] mb-1">파워트레인 분포</h2>
                <p className="text-[11px] text-[#6B7399]">등록 트림 기준</p>
                {engineWithPercent.length === 0 ? (
                  <p className="mt-4 text-[12px] text-[#9BA4C0]">데이터 없음</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {engineWithPercent.map((pt) => (
                      <div
                        key={pt.engineType}
                        className="flex items-center gap-2 text-[11px] font-medium text-[#4A5270]"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                          style={{ backgroundColor: pt.color }}
                        />
                        <span className="flex-1">{pt.label}</span>
                        <span className="font-bold text-[#1A1A2E]">{pt.percent}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {engineWithPercent.length > 0 && (
                <DonutPie data={engineWithPercent} />
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 내부 컴포넌트 ────────────────────────────────────────

interface KPICardProps {
  title: string;
  value: string;
  unit: string;
  icon: LucideIcon;
}

function KPICard({ title, value, unit, icon: Icon }: KPICardProps) {
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
          <ArrowUpRight size={12} /> 실시간
        </div>
      </div>
    </div>
  );
}

interface DonutSlice {
  engineType: string;
  label: string;
  percent: number;
  color: string;
}

function DonutPie({ data }: { data: DonutSlice[] }) {
  const slices = data.reduce<Array<DonutSlice & { offset: number }>>((acc, pt) => {
    const cumulative = acc.reduce((sum, item) => sum + item.percent, 0);
    return [...acc, { ...pt, offset: -cumulative }];
  }, []);

  return (
    <div className="w-[120px] h-[120px] relative shrink-0">
      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
        {slices.map((pt) => (
          <motion.circle
            key={pt.engineType}
            cx="50"
            cy="50"
            r="40"
            fill="transparent"
            stroke={pt.color}
            strokeWidth="16"
            strokeDasharray={`${pt.percent} 100`}
            initial={{ strokeDashoffset: -100 }}
            animate={{ strokeDashoffset: pt.offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        ))}
      </svg>
    </div>
  );
}

const ENGINE_TYPE_LABELS: Record<string, string> = {
  hybrid: "하이브리드",
  gasoline: "가솔린",
  diesel: "디젤",
  electric: "전기 (EV)",
  hydrogen: "수소",
};
