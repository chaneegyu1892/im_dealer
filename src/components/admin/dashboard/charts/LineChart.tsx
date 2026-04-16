"use client";

import type { DailyCount } from "@/types/admin";

interface LineChartProps {
  data: DailyCount[];
  color: string;
  height?: number;
}

export function LineChart({ data, color, height = 130 }: LineChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-[12px] text-[#9BA4C0]" style={{ height }}>데이터 없음</div>;
  }

  const W = 500;
  const H = height;
  const P = { t: 10, r: 8, b: 20, l: 26 };
  const cW = W - P.l - P.r;
  const cH = H - P.t - P.b;
  const vals = data.map((d) => d.count);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals);
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => ({
    x: P.l + (i / Math.max(data.length - 1, 1)) * cW,
    y: P.t + cH - ((d.count - minV) / range) * cH,
    ...d,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const fillD = pathD + ` L ${pts[pts.length - 1].x.toFixed(1)} ${(P.t + cH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(P.t + cH).toFixed(1)} Z`;
  const gid = `lg-${color.replace("#", "")}`;

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
  const getDay = (dateStr: string) => dayLabels[new Date(dateStr).getDay()];

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
          <text x={p.x} y={H - 2} textAnchor="middle" fontSize="8.5" fill="#9BA4C0">
            {getDay(p.date)}
          </text>
        </g>
      ))}
      <text x={P.l - 3} y={P.t + 4} textAnchor="end" fontSize="8" fill="#C0C5D8">{maxV}</text>
      <text x={P.l - 3} y={P.t + cH + 2} textAnchor="end" fontSize="8" fill="#C0C5D8">{minV}</text>
    </svg>
  );
}
