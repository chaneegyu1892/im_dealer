"use client";

import type { CategoryCount } from "@/types/admin";

const COLORS = ["#000666", "#7C3AED", "#D97706", "#059669", "#0EA5E9", "#F43F5E"];

interface DonutChartProps {
  data: CategoryCount[];
}

export function DonutChart({ data }: DonutChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-[12px] text-[#9BA4C0] h-[124px]">데이터 없음</div>;
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const R = 50;
  const CX = 62;
  const CY = 62;
  const SW = 18;
  const circ = 2 * Math.PI * R;

  let cum = 0;
  const segs = data.map((d, i) => {
    const frac = d.count / total;
    const offset = circ * (1 - cum);
    const dash = circ * frac - 1.5;
    cum += frac;
    return { ...d, offset, dash, color: COLORS[i % COLORS.length] };
  });

  return (
    <div className="flex items-center gap-6 w-full h-full">
      <svg width="124" height="124" viewBox="0 0 124 124" className="shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F0F2F8" strokeWidth={SW} />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeDasharray={`${s.dash} ${circ}`}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        ))}
        <text x={CX} y={CY - 5} textAnchor="middle" fontSize="20" fontWeight="700" fill="#1A1A2E">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="9" fill="#9BA4C0">총 차량</text>
      </svg>
      <div className="flex-1 space-y-2">
        {segs.map((d, i) => (
          <div key={d.category} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="text-[12px] text-[#6B7399]">{d.category}</span>
            </div>
            <span className="text-[12px] font-semibold text-[#1A1A2E]">{d.count}대</span>
          </div>
        ))}
      </div>
    </div>
  );
}
