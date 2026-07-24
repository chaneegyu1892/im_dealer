"use client";

import { useState } from "react";
import type { CapitalRateSheet, RateSheetRaw, RateSheetKey } from "@/types/admin";
import { calcRateMatrix, RATE_KEYS } from "@/lib/quote-calculator";

/** 라인업 단위 수집 결과 (CapitalRateManager 가 draft.trims 를 라인업별로 묶어 전달). */
export interface PerLineupResult {
  lineupId: string;
  lineupName: string;
  trimIds: string[]; // 저장 대상(라인업 내 전체 트림)
  minVehiclePrice: number;
  maxVehiclePrice: number;
  minBaseRates: RateSheetRaw;
  maxBaseRates: RateSheetRaw;
  matchedCount: number;
  unmatchedCount: number;
}

interface Props {
  results: PerLineupResult[];
  existingByLineup: Record<string, CapitalRateSheet | undefined>;
  financeCompanyId: string;
  productType: string;
  weekOf: string;
  onSaved: () => void; // 저장 후 활성시트 갱신
  onClose: () => void; // 검토 종료(초안 정리)
}

const MONTHS = [36, 48, 60];
const MILEAGES = [10000, 20000, 30000];
const MILEAGE_LABEL: Record<number, string> = { 10000: "1만", 20000: "2만", 30000: "3만" };

function emptyRates(): RateSheetRaw {
  return Object.fromEntries(RATE_KEYS.map((k) => [k, 0])) as RateSheetRaw;
}
const pct = (v: number) => (v > 0 ? (v * 100).toFixed(3) + "%" : "-");

/** 한 기준(최소가/최대가)을 기존↔신규로 비교 렌더 — 월납입금(원) 주, 회수율(%) 보조. */
function CompareMatrix({ label, price, oldMatrix, newMatrix, oldBase, newBase }: { label: string; price: number; oldMatrix?: RateSheetRaw; newMatrix: RateSheetRaw; oldBase?: RateSheetRaw; newBase: RateSheetRaw }) {
  return (
    <div className="flex-1 min-w-[280px]">
      <p className="text-xs font-semibold text-[#4A5270] mb-1.5">
        {label} <span className="text-[#9BA4C0] font-normal">{price.toLocaleString("ko-KR")}원</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border border-[#E8EAF2] rounded-lg">
          <thead>
            <tr className="bg-[#F8F9FC]">
              <th className="py-1 px-2 text-left text-[#9BA4C0] font-medium">거리</th>
              {MONTHS.map((m) => (
                <th key={m} className="py-1 px-2 text-center text-[#9BA4C0] font-medium">{m}개월</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MILEAGES.map((mil) => (
              <tr key={mil} className="border-t border-[#F0F1FA]">
                <td className="py-1 px-2 text-[#9BA4C0]">{MILEAGE_LABEL[mil]}km</td>
                {MONTHS.map((mo) => {
                  const key = `${mo}_${mil}` as RateSheetKey;
                  const nWon = newBase[key] ?? 0;
                  const oWon = oldBase?.[key] ?? 0;
                  const nv = newMatrix[key] ?? 0;
                  const changed = oldBase ? Math.abs(nWon - oWon) > 0 : false;
                  return (
                    <td key={mo} className="py-1 px-2 text-center font-mono">
                      <span className={`block font-semibold ${changed ? "text-[#0A7E3D]" : "text-[#1A1A2E]"}`}>{nWon > 0 ? nWon.toLocaleString("ko-KR") : "-"}</span>
                      {oldBase && oWon > 0 && (
                        <span className={`block text-[10px] ${changed ? "text-[#C0392B] line-through" : "text-[#C8CDD8]"}`}>{oWon.toLocaleString("ko-KR")}</span>
                      )}
                      <span className="block text-[9px] text-[#B0B8D0]">{pct(nv)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineupCard({ r, existing, onSave, saving, saved }: { r: PerLineupResult; existing?: CapitalRateSheet; onSave: () => void; saving: boolean; saved: boolean }) {
  const noData = r.matchedCount === 0;
  const newMin = calcRateMatrix(r.minBaseRates, r.minVehiclePrice);
  const newMax = calcRateMatrix(r.maxBaseRates, r.maxVehiclePrice);
  return (
    <div className={`rounded-xl border p-4 ${saved ? "border-emerald-300 bg-emerald-50/40" : "border-[#E8EAF2] bg-white"}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-[#1A1A2E]">{r.lineupName}</span>
          {existing ? (
            <span className="text-[10px] bg-[#EEF0FA] text-[#6066EE] px-1.5 py-0.5 rounded-full">기존값 있음 · 비교</span>
          ) : (
            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">신규</span>
          )}
          <span className="text-[11px] text-[#9BA4C0]">수집 {r.matchedCount}트림{r.unmatchedCount > 0 ? ` · 매칭실패 ${r.unmatchedCount}` : ""}</span>
        </div>
        {saved ? (
          <span className="text-xs font-semibold text-emerald-600">✓ 저장됨</span>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || noData}
            className="rounded-lg bg-[#000666] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#000888] disabled:opacity-40"
          >
            {saving ? "저장 중..." : "이 라인업 저장"}
          </button>
        )}
      </div>
      {noData ? (
        <p className="text-xs text-[#C0392B]">매칭된 트림이 없어 수집값이 없습니다. (차량명/트림명 자동매칭 실패 — 이름 확인 필요)</p>
      ) : (
        <div className="flex gap-4 flex-wrap">
          <CompareMatrix label="최소가 기준 · 월납입금(원)" price={r.minVehiclePrice} oldMatrix={existing?.minRateMatrix} newMatrix={newMin} oldBase={existing?.minBaseRates} newBase={r.minBaseRates} />
          <CompareMatrix label="최대가 기준 · 월납입금(원)" price={r.maxVehiclePrice} oldMatrix={existing?.maxRateMatrix} newMatrix={newMax} oldBase={existing?.maxBaseRates} newBase={r.maxBaseRates} />
        </div>
      )}
    </div>
  );
}

export default function ScrapeReviewPanel({ results, existingByLineup, financeCompanyId, productType, weekOf, onSaved, onClose }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const saveLineup = async (r: PerLineupResult): Promise<boolean> => {
    if (r.matchedCount === 0) return false;
    const existing = existingByLineup[r.lineupId];
    const res = await fetch("/api/admin/capital-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        financeCompanyId,
        trimIds: r.trimIds,
        productType,
        weekOf,
        minVehiclePrice: r.minVehiclePrice,
        maxVehiclePrice: r.maxVehiclePrice,
        minBaseRates: r.minBaseRates,
        maxBaseRates: r.maxBaseRates,
        // 선납/보증은 자동수집 대상 아님 — 기존값 유지(있으면), 없으면 0
        minDepositRates: existing?.minDepositRates ?? emptyRates(),
        minPrepayRates: existing?.minPrepayRates ?? emptyRates(),
        maxDepositRates: existing?.maxDepositRates ?? emptyRates(),
        maxPrepayRates: existing?.maxPrepayRates ?? emptyRates(),
        memo: "자동 수집",
      }),
    });
    if (!res.ok) {
      alert(`${r.lineupName} 저장 실패: ${await res.text()}`);
      return false;
    }
    return true;
  };

  const handleSaveOne = async (r: PerLineupResult) => {
    setSavingId(r.lineupId);
    try {
      if (await saveLineup(r)) {
        setSavedIds((p) => new Set(p).add(r.lineupId));
        onSaved();
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    setBulkSaving(true);
    try {
      for (const r of results) {
        if (savedIds.has(r.lineupId) || r.matchedCount === 0) continue;
        if (await saveLineup(r)) setSavedIds((p) => new Set(p).add(r.lineupId));
      }
      onSaved();
    } finally {
      setBulkSaving(false);
    }
  };

  const savable = results.filter((r) => r.matchedCount > 0).length;
  const allSaved = results.every((r) => r.matchedCount === 0 || savedIds.has(r.lineupId));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-[#D7DBF0] bg-[#F0F1FA] px-4 py-3">
        <div className="text-sm">
          <span className="font-bold text-[#3A41C8]">수집 결과 검토</span>
          <span className="ml-2 text-[#6066EE]">라인업 {results.length}개 · 저장 가능 {savable}개</span>
          <p className="text-[11px] text-[#8890AC] mt-0.5">기존값과 비교 후, 라인업별 또는 전체 저장하세요. <span className="text-[#0A7E3D]">초록=신규</span> / <span className="text-[#C0392B]">빨강 취소선=기존</span>.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#C8CDE8] px-3 py-1.5 text-xs font-semibold text-[#6A72A0] hover:bg-white">
            닫기
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={bulkSaving || allSaved || savable === 0}
            className="rounded-lg bg-[#6066EE] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#4F55D8] disabled:opacity-40"
          >
            {bulkSaving ? "전체 저장 중..." : allSaved ? "전체 저장 완료" : "전체 저장"}
          </button>
        </div>
      </div>

      {results.map((r) => (
        <LineupCard
          key={r.lineupId}
          r={r}
          existing={existingByLineup[r.lineupId]}
          onSave={() => handleSaveOne(r)}
          saving={savingId === r.lineupId || bulkSaving}
          saved={savedIds.has(r.lineupId)}
        />
      ))}
    </div>
  );
}
