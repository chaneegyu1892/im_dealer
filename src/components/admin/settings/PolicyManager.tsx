"use client";

import { useState, useEffect } from "react";
import { Info, RefreshCcw } from "lucide-react";

interface RankSurchargeConfig {
  rank: number;
  rate: number;
}

export default function PolicyManager() {
  const [configs, setConfigs] = useState<RankSurchargeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/policy");
      const result = await res.json();
      if (result.success) setConfigs(result.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleUpdate = async (rank: number, rate: number) => {
    setSaving(rank);
    try {
      const res = await fetch("/api/admin/settings/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rank, rate }),
      });
      if (res.ok) {
        alert(`${rank}순위 가산율이 저장되었습니다.`);
        fetchConfigs();
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-[#9BA4C0]">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-700">
        <Info size={20} className="shrink-0" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm">운영 정책 안내</p>
          <p>• 견적 순위에 따라 자동 부과되는 가산율(Surcharge)을 관리합니다.</p>
          <p>• 설정값은 신규 견적 산출 시 즉시 반영됩니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((r) => {
          const config = configs.find((c) => c.rank === r);
          const currentRate = config?.rate ?? 0;

          return (
            <div key={r} className="bg-white border border-[#E8EAF0] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-[#6066EE] uppercase tracking-wider">{r}순위 가산</span>
                <span className="text-[9px] bg-[#F0F1FA] text-[#9BA4C0] px-1.5 py-0.5 rounded">Rank {r}</span>
              </div>
              
              <div className="flex items-center gap-2 max-w-[120px]">
                <input
                  type="number"
                  step="0.1"
                  defaultValue={currentRate}
                  onBlur={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val !== currentRate) handleUpdate(r, val);
                  }}
                  className="w-full px-2 py-1.5 border border-[#E8EAF0] rounded-lg text-sm font-bold text-[#1A1A2E] focus:outline-none focus:border-[#6066EE] text-center"
                />
                <span className="text-xs font-bold text-[#1A1A2E]">%</span>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-[#9BA4C0]">
                <span>현재:</span>
                <span className="font-mono font-bold text-[#1A1A2E]">{currentRate.toFixed(2)}%</span>
              </div>

              {saving === r && (
                <div className="mt-2 text-[10px] text-[#6066EE] flex items-center gap-1">
                  <RefreshCcw size={10} className="animate-spin" /> 저장 중...
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
