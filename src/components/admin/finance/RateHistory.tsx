"use client";

import type { CapitalRateSheet, RateSheetKey } from "@/types/admin";

interface Props {
  sheets: CapitalRateSheet[];
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
}

const MONTHS = [36, 48, 60];
const MILEAGES = [10000, 20000, 30000];
const MILEAGE_LABELS: Record<number, string> = {
  10000: "1만",
  20000: "2만",
  30000: "3만",
};

function formatKrDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function RateHistory({ sheets, onActivate, onDelete }: Props) {
  if (sheets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#9BA4C0] text-sm bg-white rounded-xl border border-[#E8EAF2] py-16">
        저장된 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sheets.map((sheet) => (
        <div
          key={sheet.id}
          className={`bg-white rounded-xl border p-5 ${
            sheet.isActive ? "border-[#6066EE]" : "border-[#E8EAF2]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#1A1A2E]">
                {formatKrDate(sheet.weekOf)} 주
              </span>
              {sheet.isActive ? (
                <span className="text-xs px-2 py-0.5 bg-[#6066EE] text-white rounded-full">활성</span>
              ) : (
                <span className="text-xs px-2 py-0.5 bg-[#F0F1FA] text-[#9BA4C0] rounded-full">비활성</span>
              )}
              {sheet.memo && (
                <span className="text-xs text-[#9BA4C0]">{sheet.memo}</span>
              )}
            </div>
            <div className="flex gap-2">
              {!sheet.isActive && (
                <button
                  onClick={() => onActivate(sheet.id)}
                  className="text-xs px-3 py-1 rounded-lg border border-[#6066EE] text-[#6066EE] hover:bg-[#F0F1FA]"
                >
                  활성화
                </button>
              )}
              <button
                onClick={() => onDelete(sheet.id)}
                className="text-xs px-3 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>

          {/* 요약 통계 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-[#F8F9FC] rounded-lg p-3 border border-[#F0F1FA]">
              <p className="text-[10px] uppercase font-bold text-[#9BA4C0] mb-1 tracking-tight">Base Min Price</p>
              <p className="text-sm font-bold text-[#1A1A2E]">
                {sheet.minVehiclePrice.toLocaleString("ko-KR")}원
              </p>
            </div>
            <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100">
              <p className="text-[10px] uppercase font-bold text-blue-600 mb-1 tracking-tight">Deposit 10%</p>
              <p className="text-xs text-[#1A1A2E] mb-0.5">보증금 10%당 가산율</p>
              <p className="text-sm font-bold text-[#000666]">
                {(sheet.depositDiscountRate * 100).toFixed(3)}%
              </p>
            </div>
            <div className="bg-violet-50/50 rounded-lg p-3 border border-violet-100">
              <p className="text-[10px] uppercase font-bold text-violet-600 mb-1 tracking-tight">Prepay 10%</p>
              <p className="text-xs text-[#1A1A2E] mb-0.5">선납금 10%당 가산율</p>
              <p className="text-sm font-bold text-[#000666]">
                {(sheet.prepayAdjustRate * 100).toFixed(3)}%
              </p>
            </div>
          </div>

          {/* 회수율 매트릭스 비교 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 최소가 기준 회수율 */}
            <div className="bg-[#F8F9FC] rounded-lg p-3 border border-[#F0F1FA]">
              <p className="text-[10px] uppercase font-bold text-[#9BA4C0] mb-2 tracking-tight">Recovery Rates (Min Price)</p>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-[#9BA4C0]">
                    <th className="py-1 text-left font-medium">거리</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="py-1 text-center font-medium">{m}m</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MILEAGES.map((mileage) => (
                    <tr key={mileage} className="border-t border-[#E8EAF2]">
                      <td className="py-1.5 text-[#9BA4C0] font-medium">{MILEAGE_LABELS[mileage]}</td>
                      {MONTHS.map((months) => {
                        const key = `${months}_${mileage}` as RateSheetKey;
                        const val = (sheet.minRateMatrix as any)?.[key];
                        return (
                          <td key={months} className="py-1.5 text-center font-bold text-[#000666]">
                            {val ? (val * 100).toFixed(3) + "%" : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 최대가 기준 회수율 */}
            <div className="bg-[#FFF9F5] rounded-lg p-3 border border-[#FFE4D1]">
              <p className="text-[10px] uppercase font-bold text-orange-400 mb-2 tracking-tight">Recovery Rates (Max Price)</p>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="text-orange-300">
                    <th className="py-1 text-left font-medium">거리</th>
                    {MONTHS.map((m) => (
                      <th key={m} className="py-1 text-center font-medium">{m}m</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MILEAGES.map((mileage) => (
                    <tr key={mileage} className="border-t border-[#FFE4D1]">
                      <td className="py-1.5 text-orange-400 font-medium">{MILEAGE_LABELS[mileage]}</td>
                      {MONTHS.map((months) => {
                        const key = `${months}_${mileage}` as RateSheetKey;
                        const val = (sheet.maxRateMatrix as any)?.[key];
                        return (
                          <td key={months} className="py-1.5 text-center font-bold text-orange-700">
                            {val ? (val * 100).toFixed(3) + "%" : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
