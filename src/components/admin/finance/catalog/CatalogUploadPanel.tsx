"use client";

import { useRef, useState } from "react";
import { productTypeLabel } from "@/constants/product-type";

interface Props {
  financeCompanyId: string;
  financeCompanyName: string;
}

interface UploadSummary {
  productType: string;
  total: number;
  mappedConfirmed: number;
  trimConfirmed: number;
  modelFallback: number;
  unmatched: number;
  priced: number;
  unmatchedNames: string[];
  fallbackNames: string[];
  saved: number;
}

type UploadResult = UploadSummary | { productType: string; error: string };

/** 미리보기: 파일 안의 차량(모델) 목록 — 상품 유형별. */
interface PreviewProduct {
  productType: string;
  models: { modelName: string; trims: number }[];
}

/** 엑셀 견적기(.xlsm) 업로드 → 파싱·가격매칭·산출 → 카탈로그 저장 (메리츠 등).
 *  상품 유형은 파일의 시트 구성으로 판별한다 — 수입견적 파일 한 번이면 운용리스·금융리스·할부가 함께 저장된다.
 *  [차량 골라서 가져오기]는 저장 없이 목록을 먼저 받아(preview) 선택한 차량만 저장한다. */
export default function CatalogUploadPanel({ financeCompanyId, financeCompanyName }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [weekOf, setWeekOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 차량 선택 상태 — preview 응답의 모델 목록(상품 간 합집합)과 체크 집합
  const [preview, setPreview] = useState<PreviewProduct[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResults(null);
    setError(null);
    setPreview(null);
    setSel(new Set());
    setQuery("");
  };

  const post = async (extra: Record<string, string>) => {
    const fd = new FormData();
    fd.append("file", file!);
    fd.append("financeCompanyId", financeCompanyId);
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    const res = await fetch("/api/admin/capital-catalog/meritz-upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "업로드 실패");
    return data;
  };

  /** 저장 없이 파일 분석 → 차량 목록 표시. 기본은 전체 선택(빼고 싶은 것만 해제). */
  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    reset();
    try {
      const data = await post({ mode: "preview" });
      const products: PreviewProduct[] = data.products ?? [];
      setPreview(products);
      setSel(new Set(products.flatMap((p) => p.models.map((m) => m.modelName))));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** models 없으면 전체 저장, 있으면 그 차량만 저장. */
  const upload = async (models?: string[]) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const data = await post(models && models.length > 0 ? { models: JSON.stringify(models) } : {});
      setResults(data.results);
      setWeekOf(data.weekOf);
      setPreview(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 상품 간 합집합 모델 목록 (수입견적은 3상품이 같은 차량 목록 공유 — 이름 기준으로 합친다)
  const unionModels = (() => {
    if (!preview) return [];
    const map = new Map<string, number>();
    for (const p of preview) for (const m of p.models) map.set(m.modelName, Math.max(map.get(m.modelName) ?? 0, m.trims));
    return [...map].map(([modelName, trims]) => ({ modelName, trims }));
  })();
  const shownModels = unionModels.filter((m) => !query || m.modelName.toLowerCase().includes(query.toLowerCase()));
  const toggle = (name: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-5">
        <h3 className="text-sm font-bold text-[#3A41C8] mb-1">엑셀 견적기 업로드</h3>
        <p className="text-xs text-[#9BA4C0] mb-4">
          {financeCompanyName}의 최신 <b>견적시트(.xlsm/.xlsx)</b>를 업로드하면 트림별 잔가율을 파싱하고,
          우리 시스템 차량 가격(확정 매핑 우선)과 매칭해 월납입금을 산출·저장합니다.
          <br />
          상품 유형은 <b>파일에서 자동 판별</b>되므로 위 탭과 무관하게 올리면 됩니다 —
          수입견적 파일 하나로 <b>운용리스·금융리스·할부</b>가 함께 저장됩니다.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsm,.xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }}
            className="text-sm text-[#5A6080] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EEF0FF] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#3A41C8] hover:file:bg-[#E2E5FF]"
          />
          <button
            type="button"
            onClick={analyze}
            disabled={!file || busy}
            className="rounded-lg bg-[#6066EE] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#4F55DB] transition-colors"
          >
            {busy && !preview ? "분석 중…" : "차량 골라서 가져오기"}
          </button>
          <button
            type="button"
            onClick={() => void upload()}
            disabled={!file || busy}
            className="rounded-lg border border-[#6066EE] px-4 py-2 text-xs font-bold text-[#3A41C8] disabled:opacity-40 hover:bg-[#EEF0FF] transition-colors"
          >
            전체 업로드
          </button>
        </div>

        {/* 차량 선택 — 파일 분석 결과. 기본 전체 선택, 빼고 싶은 것만 해제하거나 전체 해제 후 골라 담기 */}
        {preview && (
          <div className="mt-4 rounded-xl border border-[#EDEFF6] bg-[#FAFBFF] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#3A41C8]">
                차량 선택
                <span className="ml-2 font-normal text-[#9BA4C0]">
                  {sel.size}/{unionModels.length}대 선택
                  {preview.length > 1 && ` · 상품 ${preview.length}종(${preview.map((p) => productTypeLabel(p.productType)).join("·")})에 동일 적용`}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="차량명 검색"
                  className="h-7 w-32 rounded-lg border border-[#E8EAF2] px-2 text-xs text-[#3A3F5C] placeholder:text-[#B0B8D0] focus:border-[#6066EE] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSel(new Set(unionModels.map((m) => m.modelName)))}
                  className="text-[11px] font-semibold text-[#6066EE] hover:underline"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={() => setSel(new Set())}
                  className="text-[11px] font-semibold text-[#9BA4C0] hover:underline"
                >
                  전체 해제
                </button>
              </div>
            </div>
            <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
              {shownModels.map((m) => (
                <button
                  key={m.modelName}
                  type="button"
                  onClick={() => toggle(m.modelName)}
                  disabled={busy}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
                    sel.has(m.modelName)
                      ? "border-[#6066EE] bg-[#6066EE] text-white font-semibold"
                      : "border-[#E8EAF2] bg-white text-[#5A6080] hover:border-[#C9CEEA]"
                  }`}
                >
                  {m.modelName}
                  <span className={sel.has(m.modelName) ? "ml-1 text-white/70" : "ml-1 text-[#B0B8D0]"}>{m.trims}</span>
                </button>
              ))}
              {shownModels.length === 0 && <p className="text-[11px] text-[#9BA4C0]">검색 결과가 없습니다.</p>}
            </div>
            <button
              type="button"
              onClick={() => void upload([...sel])}
              disabled={sel.size === 0 || busy}
              className="mt-3 rounded-lg bg-[#6066EE] px-4 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-[#4F55DB] transition-colors"
            >
              {busy ? "저장 중…" : `선택 ${sel.size}대 가져오기`}
            </button>
          </div>
        )}

        {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>}
      </div>

      {results && (
        <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-5">
          <h3 className="text-sm font-bold text-[#3A41C8] mb-3">
            수집 완료 {weekOf && <span className="font-semibold text-[#9BA4C0]">· 수집 주 {new Date(weekOf).toLocaleDateString("ko-KR")}</span>}
          </h3>

          <div className="flex flex-col gap-4">
            {results.map((r) => (
              <div key={r.productType}>
                <div className="text-xs font-bold text-[#5A6080] mb-2">{productTypeLabel(r.productType)}</div>
                {"error" in r ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                    저장하지 못했습니다 — {r.error}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Stat label="전체 트림" value={r.total} />
                      <Stat label="저장" value={r.saved} tone="indigo" />
                      <Stat label="요율 산출" value={r.priced} tone="green" />
                      <Stat label="매핑 확정" value={r.mappedConfirmed} tone="indigo" />
                      <Stat label="이름 매칭" value={r.trimConfirmed} tone="green" />
                      <Stat label="모델만 일치" value={r.modelFallback} tone="amber" />
                      <Stat label="미매칭" value={r.unmatched} tone="gray" />
                    </div>
                    {r.saved < r.total && (
                      <p className="mt-2 text-[11px] text-[#9BA4C0]">
                        저장 {r.saved}건 &lt; 전체 {r.total}건 — 차량 선택 저장이면 정상이며, 매칭 통계(확정/이름/폴백/미매칭)는 파일 전체 기준입니다.
                      </p>
                    )}
                    <NameList title={`미매칭 트림 (${r.unmatched})`} names={r.unmatchedNames} total={r.unmatched} />
                    <NameList title={`트림 검토 요망 — 모델만 일치 (${r.modelFallback})`} names={r.fallbackNames} total={r.modelFallback} />
                  </>
                )}
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs text-[#9BA4C0]">
            <b className="text-[#3A41C8]">매핑 확정</b>은 확정 매핑의 우리 트림 가격이 주입된 정확값입니다.
            <b className="text-amber-600"> 모델만 일치</b>는 base 트림 가격 근사값이라 견적 반영에서 제외되므로,
            미매칭과 함께 <b>매핑·견적 반영 탭에서 매핑을 확정한 뒤 재업로드</b>해 주세요.
            (매핑은 상품 유형별로 따로 확정합니다.)
          </p>
        </div>
      )}
    </div>
  );
}

function NameList({ title, names, total }: { title: string; names: string[]; total: number }) {
  if (names.length === 0) return null;
  return (
    <details className="mt-3 rounded-xl border border-[#E8EAF0] bg-[#F8F9FC] px-3 py-2">
      <summary className="cursor-pointer text-xs font-bold text-[#5A6080]">{title}</summary>
      <ul className="mt-2 max-h-40 overflow-y-auto text-[11px] text-[#5A6080] space-y-0.5">
        {names.map((n) => (
          <li key={n} className="truncate">· {n}</li>
        ))}
        {total > names.length && <li className="text-[#9BA4C0]">… 외 {total - names.length}건</li>}
      </ul>
    </details>
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
