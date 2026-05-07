"use client";

import { useEffect, useState } from "react";
import {
  Calculator, UserCheck, MousePointerClick, Wallet, type LucideIcon,
} from "lucide-react";
import { LineChart } from "@/components/admin/dashboard/charts/LineChart";
import { BarChart } from "@/components/admin/dashboard/charts/BarChart";
import { cn } from "@/lib/utils";
import type { CategoryCount, VehicleQuoteStats } from "@/types/admin";

interface StatsTabProps {
  vehicleId: string;
}

type Period = "7d" | "30d" | "all";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "all", label: "전체" },
];

export function StatsTab({ vehicleId }: StatsTabProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<VehicleQuoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/vehicles/${vehicleId}/quote-stats?period=${period}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? "조회 실패");
        return body.data as VehicleQuoteStats;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "조회 실패");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, period]);

  return (
    <div className="space-y-5">
      {/* 헤더 + 기간 토글 */}
      <div className="flex items-center justify-between bg-white p-5 rounded-[12px] border border-[#E8EAF0] shadow-sm">
        <div>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">견적 계산 조회 분석</h2>
          <p className="text-[12px] text-[#6B7399] mt-0.5">
            이 차량으로 견적 계산을 시도한 트래픽을 분석합니다.
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-[#F0F2F8] rounded-[8px]">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={cn(
                "px-3 py-1.5 text-[12px] font-bold rounded-[6px] transition-all",
                period === opt.key
                  ? "bg-white text-[#000666] shadow-sm"
                  : "text-[#6B7399] hover:bg-white/50"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[13px] rounded-[8px] p-4">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-10 text-center text-[13px] text-[#9BA4C0] shadow-sm">
          불러오는 중...
        </div>
      )}

      {data && (
        <>
          {/* KPI 4개 */}
          <div className="grid grid-cols-4 gap-4">
            <KPICard
              label="견적 계산 수"
              value={data.totalCount.toLocaleString()}
              unit="건"
              icon={Calculator}
              color="#000666"
              bg="#E5E5FA"
            />
            <KPICard
              label="평균 결과 월납입금"
              value={data.avgMonthly > 0 ? data.avgMonthly.toLocaleString() : "-"}
              unit="원"
              icon={Wallet}
              color="#0EA5E9"
              bg="#E0F2FE"
            />
            <KPICard
              label="회원 비율"
              value={data.memberRatio.toFixed(1)}
              unit="%"
              icon={UserCheck}
              color="#7C3AED"
              bg="#F5F3FF"
            />
            <KPICard
              label="신청 클릭률"
              value={data.applyClickRate.toFixed(1)}
              unit="%"
              icon={MousePointerClick}
              color="#D97706"
              bg="#FFFBEB"
            />
          </div>

          {/* 일별 추이 + TOP 5 */}
          <div className="grid grid-cols-3 gap-4">
            <Section title="일별 견적 계산 추이" subtitle={periodLabel(period)} className="col-span-2">
              {data.dailyTrend.length > 0 ? (
                <LineChart data={data.dailyTrend} color="#000666" height={220} />
              ) : (
                <EmptyHint />
              )}
            </Section>
            <Section title="자주 선택된 트림 TOP 5">
              {data.topTrims.length > 0 ? (
                <BarChart data={data.topTrims} color="#000666" height={200} />
              ) : (
                <EmptyHint />
              )}
            </Section>
          </div>

          {/* 옵션 + 계약조건 */}
          <div className="grid grid-cols-3 gap-4">
            <Section title="자주 선택된 옵션 TOP 5">
              {data.topOptions.length > 0 ? (
                <BarChart data={data.topOptions} color="#7C3AED" height={200} />
              ) : (
                <EmptyHint />
              )}
            </Section>
            <Section title="계약 개월 분포" className="col-span-1">
              <MiniDonut data={data.conditionDistribution.months} />
            </Section>
            <Section title="주행거리 / 보증금·선납금">
              <div className="grid grid-cols-2 gap-2">
                <MiniDonut data={data.conditionDistribution.mileages} small />
                <MiniDonut data={data.conditionDistribution.depositPrepayMix} small />
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function periodLabel(p: Period): string {
  if (p === "7d") return "최근 7일";
  if (p === "30d") return "최근 30일";
  return "전체 기간";
}

interface KPICardProps {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

function KPICard({ label, value, unit, icon: Icon, color, bg }: KPICardProps) {
  return (
    <div className="bg-white rounded-[12px] border border-[#E8EAF0] p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
          style={{ background: bg }}
        >
          <Icon size={16} style={{ color }} />
        </div>
        <span className="text-[11px] text-[#6B7399] font-medium truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[24px] font-bold text-[#1A1A2E] leading-none">{value}</span>
        <span className="text-[12px] text-[#9BA4C0]">{unit}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-[12px] border border-[#E8EAF0] p-5 shadow-sm",
        className
      )}
    >
      <div className="mb-3">
        <h3 className="text-[13px] font-bold text-[#1A1A2E]">{title}</h3>
        {subtitle && <p className="text-[11px] text-[#9BA4C0] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="text-[12px] text-[#9BA4C0] py-8 text-center">
      데이터가 아직 부족합니다
    </p>
  );
}

const DONUT_COLORS = ["#000666", "#7C3AED", "#D97706", "#059669"];

function MiniDonut({ data, small = false }: { data: CategoryCount[]; small?: boolean }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <EmptyHint />;

  const size = small ? 80 : 110;
  const R = small ? 30 : 42;
  const SW = small ? 10 : 14;
  const C = size / 2;
  const circ = 2 * Math.PI * R;
  const segs = data.reduce<Array<CategoryCount & { offset: number; dash: number; color: string }>>(
    (acc, d, i) => {
      const cum = acc.reduce((sum, seg) => sum + seg.count / total, 0);
      const frac = d.count / total;
      return [
        ...acc,
        {
          ...d,
          offset: circ * (1 - cum),
          dash: circ * frac - 1,
          color: DONUT_COLORS[i % DONUT_COLORS.length],
        },
      ];
    },
    []
  );

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="shrink-0" style={{ width: size, height: size }}>
        <circle cx={C} cy={C} r={R} fill="none" stroke="#F0F2F8" strokeWidth={SW} />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeDasharray={`${s.dash} ${circ}`}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${C} ${C})`}
          />
        ))}
        <text
          x={C}
          y={C + 3}
          textAnchor="middle"
          fontSize={small ? 11 : 14}
          fontWeight="700"
          fill="#1A1A2E"
        >
          {total}
        </text>
      </svg>
      <div className="mt-2 w-full space-y-0.5">
        {segs.map((s) => (
          <div key={s.category} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[#6B7399] truncate">{s.category}</span>
            </div>
            <span className="font-semibold text-[#1A1A2E] shrink-0">
              {Math.round((s.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
