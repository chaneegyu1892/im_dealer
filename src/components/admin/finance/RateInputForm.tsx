"use client";

import { useState, useEffect } from "react";
import type { CapitalRateSheet, RateSheetRaw, RateSheetKey } from "@/types/admin";
import {
  calcRateMatrix,
  calcDepositDiscountRate,
  calcPrepayAdjustRate,
  RATE_KEYS,
} from "@/lib/quote-calculator";

interface Props {
  financeCompanyId: string;
  trimIds: string[];
  /** 선택된 라인업 내 트림들의 가격 기준 자동 계산된 최소가 (discountPrice 우선) */
  initialMinPrice: number;
  /** 선택된 라인업 내 트림들의 가격 기준 자동 계산된 최대가 (discountPrice 우선) */
  initialMaxPrice: number;
  productType: string;
  existingSheet?: CapitalRateSheet;
  onSaved: (savedTrimIds: string[]) => void;
}

const MONTHS = [36, 48, 60];
const MILEAGES = [10000, 20000, 30000];
const MILEAGE_LABELS: Record<number, string> = {
  10000: "1만km",
  20000: "2만km",
  30000: "3만km",
};
const inputClassName =
  "w-full border border-[#E8EAF2] rounded-lg bg-white px-3 py-1.5 text-sm text-[#1A1A2E] placeholder:text-[#B0B8D0] focus:outline-none focus:border-[#6066EE] [color-scheme:light]";
const rateInputClassName =
  "w-full text-center text-xs border border-[#E8EAF2] rounded-lg bg-white px-1.5 py-1.5 text-[#1A1A2E] placeholder:text-[#B0B8D0] focus:outline-none focus:border-[#6066EE] [color-scheme:light]";
const disabledRateInputClassName =
  "w-full text-center text-xs border border-[#EEF1F6] rounded-lg bg-[#F6F8FB] px-1.5 py-1.5 text-[#9BA4C0] cursor-not-allowed select-none [color-scheme:light]";

function emptyRates(): RateSheetRaw {
  return Object.fromEntries(RATE_KEYS.map((k) => [k, 0])) as RateSheetRaw;
}

function formatRate(v: number) {
  return v !== 0 ? (v * 100).toFixed(3) + "%" : "-";
}

function formatRateRaw(v: number) {
  return v !== 0 ? v.toFixed(5) : "-";
}

function getWeekOf(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

type PreviewData = {
  minRateMatrix: RateSheetRaw;
  maxRateMatrix: RateSheetRaw;
  depositDiscountRate: number;
  prepayAdjustRate: number;
};

export default function RateInputForm({
  financeCompanyId,
  trimIds,
  initialMinPrice,
  initialMaxPrice,
  productType,
  existingSheet,
  onSaved,
}: Props) {
  const [weekOf, setWeekOf] = useState(getWeekOf());
  const [minVehiclePrice, setMinVehiclePrice] = useState(initialMinPrice);
  const [maxVehiclePrice, setMaxVehiclePrice] = useState(initialMaxPrice);
  // 사용자가 수동 덮어쓰기한 경우 자동 동기화를 멈추기 위한 플래그
  const [priceManuallyEdited, setPriceManuallyEdited] = useState(false);
  const [minBaseRates, setMinBaseRates] = useState<RateSheetRaw>(emptyRates());
  const [minDepositRates, setMinDepositRates] = useState<RateSheetRaw>(emptyRates());
  const [minPrepayRates, setMinPrepayRates] = useState<RateSheetRaw>(emptyRates());
  const [maxBaseRates, setMaxBaseRates] = useState<RateSheetRaw>(emptyRates());
  const [maxDepositRates, setMaxDepositRates] = useState<RateSheetRaw>(emptyRates());
  const [maxPrepayRates, setMaxPrepayRates] = useState<RateSheetRaw>(emptyRates());
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  // 보증금·선납금 테이블은 36_10000 셀 하나만 사용 — 나머지는 0으로 초기화
  function pickSingleKey(rates: RateSheetRaw, key: RateSheetKey): RateSheetRaw {
    const empty = emptyRates();
    empty[key] = rates[key] ?? 0;
    return empty;
  }

  useEffect(() => {
    if (existingSheet) {
      setMinVehiclePrice(existingSheet.minVehiclePrice);
      setMaxVehiclePrice(existingSheet.maxVehiclePrice);
      setMinBaseRates(existingSheet.minBaseRates);
      setMinDepositRates(pickSingleKey(existingSheet.minDepositRates, "36_10000"));
      setMinPrepayRates(pickSingleKey(existingSheet.minPrepayRates, "36_10000"));
      setMaxBaseRates(existingSheet.maxBaseRates);
      setMaxDepositRates(pickSingleKey(existingSheet.maxDepositRates, "36_10000"));
      setMaxPrepayRates(pickSingleKey(existingSheet.maxPrepayRates, "36_10000"));
      setMemo(existingSheet.memo ?? "");
      setWeekOf(existingSheet.weekOf.slice(0, 10));
      setPriceManuallyEdited(true); // 기존 시트값을 그대로 유지
    } else {
      setMinVehiclePrice(initialMinPrice);
      setMaxVehiclePrice(initialMaxPrice);
      setMinBaseRates(emptyRates());
      setMinDepositRates(emptyRates());
      setMinPrepayRates(emptyRates());
      setMaxBaseRates(emptyRates());
      setMaxDepositRates(emptyRates());
      setMaxPrepayRates(emptyRates());
      setMemo("");
      setWeekOf(getWeekOf());
      setPriceManuallyEdited(false);
    }
    setPreview(null);
  }, [existingSheet, trimIds.join(","), initialMinPrice, initialMaxPrice]);

  // 라인업 선택 변경 → 자동 가격 갱신 (단, 사용자가 수동 편집한 경우는 유지)
  useEffect(() => {
    if (existingSheet) return;
    if (priceManuallyEdited) return;
    setMinVehiclePrice(initialMinPrice);
    setMaxVehiclePrice(initialMaxPrice);
  }, [initialMinPrice, initialMaxPrice, existingSheet, priceManuallyEdited]);

  const resetPriceToAuto = () => {
    setMinVehiclePrice(initialMinPrice);
    setMaxVehiclePrice(initialMaxPrice);
    setPriceManuallyEdited(false);
    setPreview(null);
  };

  const updateRate = (
    setter: React.Dispatch<React.SetStateAction<RateSheetRaw>>,
    key: RateSheetKey,
    value: string
  ) => {
    const num = parseInt(value.replace(/,/g, ""), 10);
    setter((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : num }));
    setPreview(null);
  };

  const calcPreview = (): PreviewData => {
    const minRateMatrix = calcRateMatrix(minBaseRates, minVehiclePrice);
    const maxRateMatrix = calcRateMatrix(maxBaseRates, maxVehiclePrice);
    const depositDiscountRate = calcDepositDiscountRate(minBaseRates, minDepositRates, minVehiclePrice);
    const prepayAdjustRate = calcPrepayAdjustRate(minBaseRates, minPrepayRates, minVehiclePrice);
    return { minRateMatrix, maxRateMatrix, depositDiscountRate, prepayAdjustRate };
  };

  const handlePreview = () => setPreview(calcPreview());

  const handleSave = async () => {
    const p = calcPreview();
    setPreview(p);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/capital-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financeCompanyId,
          trimIds, // 단일 ID 대신 배열 전송
          productType,
          weekOf,
          minVehiclePrice,
          maxVehiclePrice,
          minBaseRates,
          minDepositRates,
          minPrepayRates,
          maxBaseRates,
          maxDepositRates,
          maxPrepayRates,
          memo,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved(trimIds);
    } catch (e) {
      alert("저장 실패: " + e);
    } finally {
      setSaving(false);
    }
  };

  const renderTable = (
    label: string,
    rates: RateSheetRaw,
    setter: React.Dispatch<React.SetStateAction<RateSheetRaw>>,
    accentClass: string,
    activeKey?: RateSheetKey  // 지정 시 해당 셀만 활성화, 나머지는 음영 처리
  ) => (
    <div className="bg-white rounded-xl border border-[#E8EAF2]">
      <div className={`px-4 py-2.5 border-b border-[#E8EAF2] ${accentClass} rounded-t-xl flex items-center gap-2`}>
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs text-[#9BA4C0]">단위: 원</span>
        {activeKey && (
          <span className="ml-auto text-[10px] text-[#9BA4C0] bg-white/60 px-2 py-0.5 rounded-full border border-[#E8EAF2]">
            36개월 · 1만km 1개 값만 입력
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E8EAF2]">
              <th className="py-2 px-3 text-left text-[#9BA4C0] text-xs w-16">거리</th>
              {MONTHS.map((m) => (
                <th key={m} className="py-2 px-2 text-center text-[#9BA4C0] text-xs font-medium">{m}개월</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MILEAGES.map((mileage) => (
              <tr key={mileage} className="border-b border-[#F0F1FA] last:border-0">
                <td className="py-1.5 px-3 text-[#9BA4C0] text-xs whitespace-nowrap">{MILEAGE_LABELS[mileage]}</td>
                {MONTHS.map((months) => {
                  const key = `${months}_${mileage}` as RateSheetKey;
                  const isActive = !activeKey || key === activeKey;
                  return (
                    <td key={months} className="py-1 px-1.5">
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={!isActive}
                        value={isActive && rates[key] > 0 ? rates[key].toLocaleString("ko-KR") : ""}
                        onChange={(e) => updateRate(setter, key, e.target.value)}
                        placeholder={isActive ? "0" : "—"}
                        className={isActive ? rateInputClassName : disabledRateInputClassName}
                      />
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

  const renderRateTable = (label: string, rateMatrix: RateSheetRaw) => (
    <div>
      <p className="text-xs text-[#9BA4C0] font-medium mb-1.5">{label}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#E8EAF2]">
              <th className="py-1 px-2 text-left text-[#9BA4C0]">거리</th>
              {MONTHS.map((m) => (
                <th key={m} className="py-1 px-2 text-center text-[#9BA4C0]">{m}개월</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MILEAGES.map((mileage) => (
              <tr key={mileage} className="border-b border-[#F0F1FA] last:border-0">
                <td className="py-1 px-2 text-[#9BA4C0]">{MILEAGE_LABELS[mileage]}</td>
                {MONTHS.map((months) => {
                  const key = `${months}_${mileage}` as RateSheetKey;
                  const rate = rateMatrix[key] ?? 0;
                  return (
                    <td key={months} className="py-1 px-2 text-center font-mono">
                      <span className="block text-[#000666] font-semibold">{formatRate(rate)}</span>
                      <span className="block text-[#9BA4C0] text-[10px]">{formatRateRaw(rate)}</span>
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

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="bg-white rounded-xl border border-[#E8EAF2] p-4 grid grid-cols-2 sm:grid-cols-2 md:flex md:flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-[#9BA4C0] font-medium block mb-1">기준 주</label>
          <input
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
            className={inputClassName}
          />
        </div>
        <div>
          <label className="text-xs text-[#9BA4C0] font-medium block mb-1">
            최소 차량가 (원)
            <span className="ml-1 text-[10px] text-[#B0B8D0] font-normal">· 라인업 자동</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={minVehiclePrice.toLocaleString("ko-KR")}
            onChange={(e) => {
              const num = parseInt(e.target.value.replace(/,/g, ""), 10);
              if (!isNaN(num)) {
                setMinVehiclePrice(num);
                setPriceManuallyEdited(true);
              }
            }}
            className={`${inputClassName} md:w-40`}
          />
        </div>
        <div>
          <label className="text-xs text-[#9BA4C0] font-medium block mb-1">
            최대 차량가 (원)
            <span className="ml-1 text-[10px] text-[#B0B8D0] font-normal">· 라인업 자동</span>
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              value={maxVehiclePrice.toLocaleString("ko-KR")}
              onChange={(e) => {
                const num = parseInt(e.target.value.replace(/,/g, ""), 10);
                if (!isNaN(num)) {
                  setMaxVehiclePrice(num);
                  setPriceManuallyEdited(true);
                }
              }}
              className={`${inputClassName} md:w-40`}
            />
            {priceManuallyEdited && initialMinPrice > 0 && initialMaxPrice > 0 && (
              <button
                type="button"
                onClick={resetPriceToAuto}
                title="라인업 트림가 기준 자동값으로 복원"
                className="px-2 py-1.5 text-[10px] font-semibold text-[#000666] bg-[#F0F2F8] hover:bg-[#E8EAF0] rounded-md whitespace-nowrap"
              >
                자동값 복원
              </button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-[#9BA4C0]">
            선택된 라인업 내 트림가(할인가 우선) 기준으로 자동 입력됩니다. 옵션 풀장착으로 max를 초과하면 회수율은 max값으로 고정(클램프)되므로, 필요하면 수동으로 늘려주세요.
          </p>
        </div>
        <div className="col-span-2 sm:col-span-2 md:flex-1">
          <label className="text-xs text-[#9BA4C0] font-medium block mb-1">메모</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="선택 메모"
            className={inputClassName}
          />
        </div>
      </div>

      {/* 최소가 섹션 */}
      <div className="rounded-xl border border-blue-200 overflow-hidden">
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <span className="text-sm font-semibold text-blue-800">최소가 기준</span>
          <span className="ml-2 text-xs text-blue-500">{minVehiclePrice.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          {renderTable("기준 견적 (보증금/선납금 없음)", minBaseRates, setMinBaseRates, "bg-[#F8F9FC]")}
          {renderTable("보증금 10% 적용 견적", minDepositRates, setMinDepositRates, "bg-blue-50", "36_10000")}
          {renderTable("선납금 10% 적용 견적", minPrepayRates, setMinPrepayRates, "bg-violet-50", "36_10000")}
        </div>
      </div>

      {/* 최대가 섹션 */}
      <div className="rounded-xl border border-orange-200 overflow-hidden">
        <div className="bg-orange-50 px-4 py-2 border-b border-orange-200">
          <span className="text-sm font-semibold text-orange-800">최대가 기준</span>
          <span className="ml-2 text-xs text-orange-500">{maxVehiclePrice.toLocaleString("ko-KR")}원</span>
        </div>
        <div className="p-3 flex flex-col gap-3">
          {renderTable("기준 견적 (보증금/선납금 없음)", maxBaseRates, setMaxBaseRates, "bg-[#F8F9FC]")}
          {renderTable("보증금 10% 적용 견적", maxDepositRates, setMaxDepositRates, "bg-blue-50", "36_10000")}
          {renderTable("선납금 10% 적용 견적", maxPrepayRates, setMaxPrepayRates, "bg-violet-50", "36_10000")}
        </div>
      </div>

      {/* 계산 결과 */}
      {preview && (
        <div className="bg-white rounded-xl border-2 border-[#6066EE] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold text-[#1A1A2E] flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#6066EE] rounded-full"></span>
              계산 결과 분석
            </h3>
            <span className="text-xs text-[#9BA4C0]">현재 입력값 기준 자동 산출된 결과입니다.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {renderRateTable("회수율 매트릭스 (최소가 기준)", preview.minRateMatrix)}
            {renderRateTable("회수율 매트릭스 (최대가 기준)", preview.maxRateMatrix)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Deposit Discount</p>
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">자동산출</span>
              </div>
              <p className="text-sm font-medium text-[#1A1A2E] mb-1">보증금 10%당 가산율</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-[#000666] tracking-tight">{formatRate(preview.depositDiscountRate)}</p>
                <p className="text-[11px] text-[#9BA4C0] font-mono">({formatRateRaw(preview.depositDiscountRate)})</p>
              </div>
            </div>

            <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-100 transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Prepay Adjust</p>
                <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">자동산출</span>
              </div>
              <p className="text-sm font-medium text-[#1A1A2E] mb-1">선납금 10%당 가산율</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-[#000666] tracking-tight">{formatRate(preview.prepayAdjustRate)}</p>
                <p className="text-[11px] text-[#9BA4C0] font-mono">({formatRateRaw(preview.prepayAdjustRate)})</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-3 justify-end pb-4">
        <button
          onClick={handlePreview}
          className="px-5 py-2 rounded-lg border border-[#6066EE] text-[#6066EE] text-sm font-medium hover:bg-[#F0F1FA] transition-colors"
        >
          계산 미리보기
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-[#000666] text-white text-sm font-medium hover:bg-[#000888] disabled:opacity-50 transition-colors"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
