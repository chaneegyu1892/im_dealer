"use client";

import { formatCurrency } from "@/lib/utils";
import type { QuoteScenarioDetail } from "@/types/quote";

interface QuoteMonthlyDonutProps {
  scenario: Readonly<QuoteScenarioDetail>;
}

export function QuoteMonthlyDonut({ scenario }: QuoteMonthlyDonutProps) {
  const { breakdown: bd, surcharges: sc, purchaseSurcharge, monthlyPayment } = scenario;
  if (!bd || !sc) return null;

  // monthlyBeforeSurcharge + totalSurcharge + purchaseSurcharge ≈ monthlyPayment
  const vehicleShare = Number.isFinite(bd.monthlyBeforeSurcharge) ? bd.monthlyBeforeSurcharge : 0;
  const financeShare = Number.isFinite(sc.totalSurcharge) ? sc.totalSurcharge : 0;
  const purchaseShare = Number.isFinite(purchaseSurcharge) ? purchaseSurcharge : 0;
  const total = vehicleShare + financeShare + purchaseShare;
  if (!(total > 0)) return null;

  const depositSaving = bd.depositDiscount > 0 ? bd.depositDiscount : 0;
  const prepaySaving = bd.prepayAdjust < 0 ? Math.abs(bd.prepayAdjust) : 0;

  type Seg = { label: string; value: number; color: string };
  const segs: Seg[] = [
    { label: "차량 대여료", value: vehicleShare, color: "#000666" },
    { label: "이자·수수료", value: financeShare, color: "#6066EE" },
    ...(purchaseShare > 0
      ? [{ label: "인수 옵션비", value: purchaseShare, color: "#1A1A2E" }]
      : []),
  ];

  const R = 40;
  const CX = 52;
  const CY = 52;
  const SW = 15;
  const circ = 2 * Math.PI * R;

  let cumFrac = 0;
  const svgSegs = segs.map((seg) => {
    const frac = seg.value / total;
    const dashArray = Math.max(0, circ * frac - 1.5);
    const dashOffset = circ * (1 - cumFrac);
    cumFrac += frac;
    return { ...seg, dashArray, dashOffset };
  });

  const vehiclePct = Math.round((vehicleShare / monthlyPayment) * 100);

  return (
    <div className="rounded-[10px] bg-neutral px-4 py-3 space-y-3">
      <p className="text-[11px] font-semibold text-ink-label uppercase tracking-wider">
        월 납입금 구성
      </p>
      <div className="flex items-center gap-5">
        <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#E8EAF2" strokeWidth={SW} />
          {svgSegs.map((s, i) => (
            <circle
              key={i}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={SW}
              strokeDasharray={`${s.dashArray} ${circ}`}
              strokeDashoffset={s.dashOffset}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          ))}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#1A1A2E"
          >
            {vehiclePct}%
          </text>
          <text x={CX} y={CY + 9} textAnchor="middle" fontSize="9" fill="#9BA4C0">
            차량 원가
          </text>
        </svg>

        <div className="flex-1 space-y-2.5">
          {svgSegs.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-[12px] text-ink-caption">{s.label}</span>
              </div>
              <span className="text-[12px] font-semibold text-ink tabular-nums">
                {formatCurrency(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {(depositSaving > 0 || prepaySaving > 0) && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-800">
          {depositSaving > 0 && (
            <span className="inline-flex items-center text-[11px] bg-secondary-100 text-secondary rounded-pill px-2.5 py-1">
              보증금 절감 −{formatCurrency(depositSaving)}/월
            </span>
          )}
          {prepaySaving > 0 && (
            <span className="inline-flex items-center text-[11px] bg-secondary-100 text-secondary rounded-pill px-2.5 py-1">
              선납금 절감 −{formatCurrency(prepaySaving)}/월
            </span>
          )}
        </div>
      )}
    </div>
  );
}
