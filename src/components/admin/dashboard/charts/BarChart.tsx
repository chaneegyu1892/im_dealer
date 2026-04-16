"use client";

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
  height?: number;
}

export function BarChart({ data, color, height = 120 }: BarChartProps) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center text-[12px] text-[#9BA4C0]" style={{ height }}>데이터 없음</div>;
  }

  const maxV = Math.max(...data.map((d) => d.value), 1);
  const bW = 32;
  const gap = 11;
  const cH = height - 22;
  const totalW = data.length * (bW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${totalW} ${height}`} className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const bH = (d.value / maxV) * cH;
        const x = i * (bW + gap);
        const y = cH - bH;
        return (
          <g key={i}>
            <rect x={x} y={0} width={bW} height={cH} rx="3" fill={color} fillOpacity="0.06" />
            <rect x={x} y={y} width={bW} height={bH} rx="3" fill={color} fillOpacity={0.2 + (d.value / maxV) * 0.65} />
            <text x={x + bW / 2} y={height} textAnchor="middle" fontSize="8" fill="#9BA4C0">{d.label}</text>
            <text x={x + bW / 2} y={y - 2} textAnchor="middle" fontSize="8" fill={color} fontWeight="600">{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}
