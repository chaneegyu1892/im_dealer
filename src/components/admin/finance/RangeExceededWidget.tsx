"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";

interface ExceededItem {
  trimId: string;
  vehicleId: string;
  vehicleName: string;
  trimName: string;
  exceededCount: number;
  sessions: number;
}

interface ApiResponse {
  success: boolean;
  data?: {
    since: string;
    days: number;
    totalExceeded: number;
    items: ExceededItem[];
  };
}

interface RangeExceededWidgetProps {
  days?: number;
  limit?: number;
}

// 회수율 시트 범위 초과 견적 위젯.
// 어드민에게 "이 트림들은 max를 더 넓혀야 합니다" 신호 제공.
export function RangeExceededWidget({ days = 30, limit = 10 }: RangeExceededWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExceededItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/quote-stats/range-exceeded?days=${days}&limit=${limit}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.success || !json.data) {
        throw new Error("집계 실패");
      }
      setItems(json.data.items);
      setTotal(json.data.totalExceeded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days, limit]);

  return (
    <div className="bg-white rounded-[12px] border border-[#E8EAF0] shadow-sm">
      <div className="px-5 py-4 border-b border-[#F0F2F8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[8px] bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-[#1A1A2E]">회수율 범위 초과 견적</h3>
            <p className="text-[11px] text-[#9BA4C0]">
              최근 {days}일 · 차량가가 회수율 시트의 max를 넘어 클램프된 견적
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 text-[#9BA4C0] hover:text-[#000666] hover:bg-[#F0F2F8] rounded-[6px] disabled:opacity-40 transition-colors"
          aria-label="새로고침"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="p-5">
        {loading && items.length === 0 ? (
          <p className="text-[12px] text-[#9BA4C0] text-center py-6">집계 중…</p>
        ) : error ? (
          <p className="text-[12px] text-red-500 text-center py-6">{error}</p>
        ) : items.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[13px] text-emerald-600 font-medium">✓ 범위 초과 견적 없음</p>
            <p className="text-[11px] text-[#9BA4C0] mt-1">모든 트림의 회수율 시트가 견적 범위를 커버하고 있습니다.</p>
          </div>
        ) : (
          <>
            <div className="mb-3 px-3 py-2 bg-amber-50 rounded-[6px]">
              <p className="text-[12px] text-amber-700">
                총 <span className="font-bold">{total.toLocaleString()}건</span>의 견적이 회수율 시트 범위를 벗어났습니다.
                아래 트림은 max를 더 넓게 입력하거나 옵션을 본체와 분리해 정책을 보완하세요.
              </p>
            </div>
            <ul className="divide-y divide-[#F0F2F8]">
              {items.map((it) => (
                <li key={it.trimId} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#1A1A2E] truncate">
                      {it.vehicleName}
                      <span className="text-[#9BA4C0] font-normal"> · {it.trimName}</span>
                    </p>
                    <p className="text-[11px] text-[#9BA4C0] mt-0.5">
                      세션 {it.sessions.toLocaleString()}건 · 견적 {it.exceededCount.toLocaleString()}건
                    </p>
                  </div>
                  <a
                    href={`/admin/vehicles/${it.vehicleId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#000666] hover:underline flex items-center gap-1 shrink-0"
                  >
                    차량 열기 <ExternalLink size={11} />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
