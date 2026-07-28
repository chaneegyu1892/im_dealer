"use client";

import { useRef, useState } from "react";
import { excelUploadSupported } from "@/lib/scraper/excel-capitals";

interface Props {
  financeCompanyId: string;
  financeCompanyName: string;
  productType: string;
}

interface UploadSummary {
  total: number;
  trimConfirmed: number;
  modelFallback: number;
  unmatched: number;
  priced: number;
  saved: number;
  weekOf: string;
}

/** 엑셀 견적기(.xlsm) 업로드 → 파싱·가격매칭·산출 → 카탈로그 저장 (메리츠 등). */
export default function CatalogUploadPanel({ financeCompanyId, financeCompanyName, productType }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supported = excelUploadSupported(financeCompanyName, productType);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("financeCompanyId", financeCompanyId);
      fd.append("productType", productType);
      const res = await fetch("/api/admin/capital-catalog/meritz-upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setResult(data.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-10 text-center text-sm text-[#9BA4C0]">
        {financeCompanyName} {productType}은(는) 아직 엑셀 업로드를 지원하지 않습니다. (현재: 메리츠·MG캐피탈 장기렌트)
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#3A41C8] mb-1">엑셀 견적기 업로드</h3>
        <p className="text-xs text-[#9BA4C0] mb-4">
          {financeCompanyName}의 최신 <b>렌터카 견적시트(.xlsm)</b>를 업로드하면 트림별 잔가율을 파싱하고,
          우리 시스템 차량 가격과 매칭해 월납입금을 산출·저장합니다.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsm,.xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
            className="text-sm text-[#5A6080] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF0FF] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#3A41C8] hover:file:bg-[#E2E5FF]"
          />
          <button
            type="button"
            onClick={upload}
            disabled={!file || busy}
            className="rounded-lg bg-[#6066EE] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#4F55DB] transition-colors"
          >
            {busy ? "처리 중…" : "업로드 & 수집"}
          </button>
        </div>

        {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>}
      </div>

      {result && (
        <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#3A41C8] mb-3">수집 완료</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="전체 트림" value={result.total} />
            <Stat label="저장" value={result.saved} tone="indigo" />
            <Stat label="요율 산출" value={result.priced} tone="green" />
            <Stat label="트림 확정" value={result.trimConfirmed} tone="green" />
            <Stat label="모델만 일치" value={result.modelFallback} tone="amber" />
            <Stat label="미매칭" value={result.unmatched} tone="gray" />
          </div>
          <p className="mt-3 text-xs text-[#9BA4C0]">
            수집 주: {new Date(result.weekOf).toLocaleDateString("ko-KR")} · <b className="text-amber-600">모델만 일치({result.modelFallback})</b>는
            base 트림 가격을 사용하므로 <b>매핑·견적 반영 탭에서 트림 검토</b>를 권장합니다. 미매칭({result.unmatched})은 수동 매핑이 필요합니다.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "gray" }: { label: string; value: number; tone?: "indigo" | "green" | "amber" | "gray" }) {
  const c = {
    indigo: "text-[#3A41C8] bg-[#EEF0FF]",
    green: "text-green-700 bg-green-50",
    amber: "text-amber-700 bg-amber-50",
    gray: "text-[#5A6080] bg-[#F5F6FA]",
  }[tone];
  return (
    <div className={`rounded-xl px-3 py-2.5 ${c}`}>
      <div className="text-lg font-extrabold tabular-nums">{value}</div>
      <div className="text-[11px] font-semibold opacity-80">{label}</div>
    </div>
  );
}
