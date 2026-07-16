"use client";

import { useMemo, useRef, useState } from "react";
import type { RateSheetRaw } from "@/types/admin";
import type { ScrapeDraft } from "@/types/scraper";
import { RATE_KEYS } from "@/lib/quote-calculator";
import type { PerLineupResult } from "./ScrapeReviewPanel";
import ScraperLoginModal from "./ScraperLoginModal";

/**
 * 브랜드 일괄 수집 — 선택한 캐피탈사로 한 브랜드의 모든 차량을 순차 수집·자동 저장.
 * 기존 단일차량 흐름(잡 생성 → 폴링 → 라인업 그룹화 → capital-rates 저장)을 API 호출로 재사용하며,
 * CapitalRateManager 의 단일차량 상태와 독립적으로 동작한다.
 * - 매칭된 트림에만 저장(미매칭엔 값 차용 안 함).
 * - ORIX 미보유(미매칭) 트림은 기존 활성 시트를 비활성화 → '데이터 없음'(이력 보존, 되돌리기 가능).
 * - 저장 전 활성 시트를 스냅샷해두고, "되돌리기"로 직전 상태(활성 시트)를 복원(setActive)한다.
 */

interface VehicleLite { id: string; brand: string; name: string }
interface Props {
  financeCompanyId: string;
  vehicles: VehicleLite[];
  productType: string;
  onSaved: () => void; // 저장 후 활성시트 갱신
}

function emptyRates(): RateSheetRaw {
  return Object.fromEntries(RATE_KEYS.map((k) => [k, 0])) as RateSheetRaw;
}
function weekOfMonday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type VehStatus = "ok" | "nodata" | "fail";
interface VehResult { vehicle: string; savedLineups: number; savedTrims: number; cleared: number; unmatched: number; status: VehStatus; note?: string }
interface RunSummary { savedVehicles: number; savedTrims: number; cleared: number; failed: number; reverted?: boolean }
interface CreateJobResponse { jobId?: string; error?: string }

function parseCreateJobResponse(value: unknown): CreateJobResponse {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    jobId: typeof record.jobId === "string" ? record.jobId : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
  };
}

async function readCreateJobResponse(response: Response): Promise<CreateJobResponse> {
  try {
    const value: unknown = await response.json();
    return parseCreateJobResponse(value);
  } catch {
    return {};
  }
}

// draft.trims → 라인업별 묶기. trimIds 는 매칭된 트림만(미매칭에 값 차용 방지).
function groupByLineup(draft: ScrapeDraft, detail: any): PerLineupResult[] {
  const priceOf = new Map<string, number>(detail.trims.map((t: any) => [t.id, t.discountPrice ?? t.price]));
  const lineupOf = new Map<string, string | null>(detail.trims.map((t: any) => [t.id, t.lineupId]));
  const grouped = new Map<string, {
    trims: {
      price: number;
      rates: RateSheetRaw;
      depositRates: RateSheetRaw;
      prepayRates: RateSheetRaw;
      trimId: string;
    }[];
    unmatched: number;
  }>();
  for (const tr of draft.trims) {
    const lid = lineupOf.get(tr.trimId);
    if (!lid) continue;
    const g = grouped.get(lid) ?? { trims: [], unmatched: 0 };
    if (tr.baseRates && tr.vehiclePrice > 0) {
      g.trims.push({
        price: priceOf.get(tr.trimId) ?? tr.vehiclePrice,
        rates: tr.baseRates,
        depositRates: tr.depositRates ?? emptyRates(),
        prepayRates: tr.prepayRates ?? emptyRates(),
        trimId: tr.trimId,
      });
    }
    else g.unmatched += 1;
    grouped.set(lid, g);
  }
  const out: PerLineupResult[] = [];
  for (const [lineupId, g] of grouped) {
    const name = detail.lineups.find((l: any) => l.id === lineupId)?.name ?? lineupId;
    const sorted = [...g.trims].sort((a, b) => a.price - b.price);
    const low = sorted[0], high = sorted[sorted.length - 1];
    out.push({
      lineupId, lineupName: name, trimIds: g.trims.map((x) => x.trimId), // 매칭된 트림만
      minVehiclePrice: low?.price ?? 0, maxVehiclePrice: high?.price ?? 0,
      minBaseRates: low?.rates ?? emptyRates(), maxBaseRates: high?.rates ?? emptyRates(),
      minDepositRates: low?.depositRates ?? emptyRates(),
      minPrepayRates: low?.prepayRates ?? emptyRates(),
      maxDepositRates: high?.depositRates ?? emptyRates(),
      maxPrepayRates: high?.prepayRates ?? emptyRates(),
      matchedCount: g.trims.length, unmatchedCount: g.unmatched,
    });
  }
  return out;
}

export default function BrandBatchCollector({ financeCompanyId, vehicles, productType, onSaved }: Props) {
  const brands = useMemo(() => Array.from(new Set(vehicles.map((v) => v.brand))).sort(), [vehicles]);
  const [brand, setBrand] = useState("");
  const [running, setRunning] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [cur, setCur] = useState<{ idx: number; total: number; name: string; step: string }>({ idx: 0, total: 0, name: "", step: "" });
  const [results, setResults] = useState<VehResult[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [open, setOpen] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const stopRef = useRef(false);
  // 되돌리기용: 직전 실행이 건드린 트림 + 그 전 활성 시트(트림→시트id) 스냅샷
  const lastRunRef = useRef<{ touchedTrimIds: string[]; prevActive: Record<string, string> } | null>(null);

  const brandVehicles = useMemo(() => vehicles.filter((v) => v.brand === brand), [vehicles, brand]);
  const weekOf = weekOfMonday();
  const headers = { "Content-Type": "application/json" };

  async function pollJob(jobId: string): Promise<any> {
    const deadline = Date.now() + 30 * 60 * 1000; // 차량당 최대 30분
    for (;;) {
      if (stopRef.current) return { status: "canceled" };
      if (Date.now() > deadline) return { status: "failed", error: "타임아웃(30분)" };
      await sleep(3000);
      try {
        const data = await (await fetch(`/api/admin/scrape-jobs/${jobId}`)).json();
        const job = data.job;
        if (job && ["completed", "failed", "canceled"].includes(job.status)) return job;
        if (job) setCur((c) => ({ ...c, step: `수집 중 (${job.status})` }));
      } catch { /* 일시 오류 무시, 재시도 */ }
    }
  }

  async function saveLineup(r: PerLineupResult): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/admin/capital-rates", {
      method: "POST", headers,
      body: JSON.stringify({
        financeCompanyId, trimIds: r.trimIds, productType, weekOf,
        minVehiclePrice: r.minVehiclePrice, maxVehiclePrice: r.maxVehiclePrice,
        minBaseRates: r.minBaseRates, maxBaseRates: r.maxBaseRates,
        minDepositRates: r.minDepositRates, minPrepayRates: r.minPrepayRates,
        maxDepositRates: r.maxDepositRates, maxPrepayRates: r.maxPrepayRates,
        memo: "자동 수집(브랜드 일괄)",
      }),
    });
    if (res.ok) return { ok: true };
    let error = `HTTP ${res.status}`;
    try { const j = await res.json(); error = j.error ?? JSON.stringify(j.details ?? j).slice(0, 150); } catch { /* keep status */ }
    return { ok: false, error: `${r.lineupName}: ${error}` };
  }

  async function runBatch(username: string, password: string) {
    if (!financeCompanyId || brandVehicles.length === 0) return;
    setShowLogin(false);

    stopRef.current = false;
    setRunning(true);
    setResults([]);
    setSummary(null);
    // 되돌리기용 스냅샷: 배치 전 활성 시트(트림→시트id)
    const startSheets: any[] = await (await fetch(`/api/admin/capital-rates?financeCompanyId=${financeCompanyId}`)).json().then((x) => x.data ?? []).catch(() => []);
    const prevActive: Record<string, string> = {};
    for (const s of startSheets) if (s.productType === productType && s.isActive !== false) prevActive[s.trimId] = s.id;
    const touchedTrimIds: string[] = [];
    let okVeh = 0, okTrims = 0, clearedTotal = 0, failVeh = 0;

    const list = brandVehicles;
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break;
      const v = list[i];
      setCur({ idx: i + 1, total: list.length, name: v.name, step: "상세 로드" });
      try {
        const detail = await (await fetch(`/api/admin/vehicles/${v.id}`)).json().then((x) => x.data ?? x);
        const trimIds: string[] = (detail.trims ?? []).filter((t: any) => t.lineupId).map((t: any) => t.id);
        const lineupIds: string[] = (detail.lineups ?? []).map((l: any) => l.id);
        if (trimIds.length === 0) { setResults((p) => [...p, { vehicle: v.name, savedLineups: 0, savedTrims: 0, cleared: 0, unmatched: 0, status: "nodata", note: "트림 없음" }]); continue; }
        const prices = (detail.trims ?? []).filter((t: any) => t.lineupId).map((t: any) => t.discountPrice ?? t.price);

        setCur((c) => ({ ...c, step: "수집 잡 생성" }));
        const createBody = JSON.stringify({ financeCompanyId, productType, weekOf, trimIds, vehicleId: v.id, lineupIds, minVehiclePrice: Math.min(...prices), maxVehiclePrice: Math.max(...prices), username, password });
        const doCreate = () => fetch("/api/admin/scrape-jobs", { method: "POST", headers, body: createBody });
        let createRes = await doCreate();
        let createData = await readCreateJobResponse(createRes);
        if (createRes.status === 409 && createData.jobId) { // 이전 작업 진행 중 — 대기 후 재시도
          setCur((c) => ({ ...c, step: "이전 작업 대기 중…" }));
          await pollJob(createData.jobId);
          createRes = await doCreate();
          createData = await readCreateJobResponse(createRes);
        }
        if (!createRes.ok || !createData.jobId) {
          failVeh++;
          setResults((p) => [...p, { vehicle: v.name, savedLineups: 0, savedTrims: 0, cleared: 0, unmatched: 0, status: "fail", note: createData.error ?? "잡 생성 실패" }]);
          if (createRes.status === 409) break;
          continue;
        }

        setCur((c) => ({ ...c, step: "수집 중" }));
        const job = await pollJob(createData.jobId);
        if (job.status !== "completed" || !job.draft) {
          failVeh++;
          setResults((p) => [...p, { vehicle: v.name, savedLineups: 0, savedTrims: 0, cleared: 0, unmatched: 0, status: "fail", note: job.error ?? job.status }]);
          continue;
        }

        const perLineup = groupByLineup(job.draft, detail);
        const unmatchedTrimIds: string[] = (job.draft.trims ?? []).filter((t: any) => !(t.baseRates && t.vehiclePrice > 0)).map((t: any) => t.trimId);
        let savedL = 0, savedT = 0, unmatched = 0, saveErr = "", clearedV = 0;
        const matchedLineups = perLineup.filter((r) => r.matchedCount > 0).length;

        for (const r of perLineup) {
          if (r.matchedCount === 0) { unmatched += r.unmatchedCount; continue; }
          setCur((c) => ({ ...c, step: `저장: ${r.lineupName}` }));
          const sv = await saveLineup(r);
          if (sv.ok) { savedL++; savedT += r.matchedCount; touchedTrimIds.push(...r.trimIds); } else if (!saveErr) saveErr = sv.error ?? "저장 실패";
          unmatched += r.unmatchedCount;
        }

        // ORIX 미보유(미매칭) 트림: 기존 활성 시트 비활성화 → '데이터 없음'
        for (const tid of unmatchedTrimIds) {
          const prevId = prevActive[tid];
          if (!prevId) continue; // 원래 데이터 없음
          setCur((c) => ({ ...c, step: "미보유 연식 정리" }));
          try { const res = await fetch(`/api/admin/capital-rates/${prevId}`, { method: "PATCH", headers, body: JSON.stringify({ setActive: false }) }); if (res.ok) { clearedV++; touchedTrimIds.push(tid); } } catch { /* skip */ }
        }

        clearedTotal += clearedV;
        const status: VehStatus = savedL > 0 || clearedV > 0 ? "ok" : matchedLineups > 0 ? "fail" : "nodata";
        const note = savedL > 0 ? undefined
          : matchedLineups > 0 ? `저장 실패 — ${saveErr}`
          : clearedV > 0 ? undefined
          : "매칭된 트림 없음";
        if (status === "ok") { if (savedL > 0) okVeh++; okTrims += savedT; } else if (status === "fail") failVeh++;
        setResults((p) => [...p, { vehicle: v.name, savedLineups: savedL, savedTrims: savedT, cleared: clearedV, unmatched, status, note }]);
        onSaved();
      } catch (e) {
        failVeh++;
        setResults((p) => [...p, { vehicle: v.name, savedLineups: 0, savedTrims: 0, cleared: 0, unmatched: 0, status: "fail", note: (e as Error).message.slice(0, 60) }]);
      }
    }
    setCur((c) => ({ ...c, step: stopRef.current ? "중지됨" : "완료" }));
    lastRunRef.current = { touchedTrimIds, prevActive };
    setSummary({ savedVehicles: okVeh, savedTrims: okTrims, cleared: clearedTotal, failed: failVeh });
    setRunning(false);
    onSaved();
  }

  // 방금 실행이 건드린 트림(저장+비움)을 직전 활성 시트로 일괄 복원
  async function revertBatch() {
    const lr = lastRunRef.current;
    if (!lr || lr.touchedTrimIds.length === 0) return;
    if (!confirm("방금 실행한 변경(저장·비움)을 이전 활성 데이터로 되돌릴까요?")) return;
    setReverting(true);
    const trims = Array.from(new Set(lr.touchedTrimIds));
    let done = 0, missing = 0;
    for (const tid of trims) {
      const prevId = lr.prevActive[tid];
      if (!prevId) { missing++; continue; } // 이전 활성 시트 없음(완전 신규)
      try { const res = await fetch(`/api/admin/capital-rates/${prevId}`, { method: "PATCH", headers, body: JSON.stringify({ setActive: true }) }); if (res.ok) done++; } catch { /* skip */ }
      setCur((c) => ({ ...c, step: `되돌리는 중 ${done}/${trims.length}` }));
    }
    setReverting(false);
    setSummary((s) => (s ? { ...s, reverted: true } : s));
    onSaved();
    alert(`되돌리기 완료 — ${done}개 트림을 이전 데이터로 복원했습니다.${missing ? ` (이전 데이터가 없던 신규 ${missing}개는 그대로)` : ""}`);
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-bold text-[#1A1A2E]">브랜드 일괄 수집 <span className="font-normal text-[#9BA4C0]">— 한 브랜드 전체 차량 순차 수집·자동 저장</span></span>
        <span className="text-[#9BA4C0] text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#F0F1FA] pt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} disabled={running || reverting} className="rounded-lg border border-[#D7DBF0] px-3 py-2 text-sm">
              <option value="">브랜드 선택…</option>
              {brands.map((b) => (<option key={b} value={b}>{b} ({vehicles.filter((v) => v.brand === b).length}대)</option>))}
            </select>
            {!running ? (
              <button type="button" onClick={() => setShowLogin(true)} disabled={!brand || !financeCompanyId || reverting} className="rounded-lg bg-[#6066EE] px-4 py-2 text-sm font-bold text-white hover:bg-[#4F55D8] disabled:opacity-40">
                수집 시작 {brand && `(${brandVehicles.length}대)`}
              </button>
            ) : (
              <button type="button" onClick={() => { stopRef.current = true; }} className="rounded-lg border border-[#C0392B] px-4 py-2 text-sm font-bold text-[#C0392B] hover:bg-red-50">중지</button>
            )}
            <span className="text-[11px] text-[#B0B8D0]">워커 실행 중이어야 함 · ORIX 미보유 연식은 &lsquo;데이터 없음&rsquo; 처리(이력 보존) · 계정 안전상 브랜드 단위 권장</span>
          </div>

          {(running || reverting) && (
            <div className="rounded-lg border border-[#D7DBF0] bg-[#F0F1FA] px-3 py-2 text-sm">
              {reverting ? (
                <span className="font-semibold text-[#3A41C8]">되돌리는 중… <span className="font-normal text-[#8890AC]">{cur.step}</span></span>
              ) : (
                <>
                  <span className="font-semibold text-[#3A41C8]">진행: {cur.idx}/{cur.total}</span>
                  <span className="ml-2 text-[#4A5270]">{cur.name}</span>
                  <span className="ml-2 text-[#8890AC]">— {cur.step}</span>
                </>
              )}
            </div>
          )}

          {summary && !running && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-emerald-700">
                ✅ 완료 — 차량 {summary.savedVehicles}대 · 트림 {summary.savedTrims}개 저장{summary.cleared ? ` · 미보유 ${summary.cleared}개 비움` : ""}{summary.failed ? ` · 실패 ${summary.failed}` : ""}
                {summary.reverted && <span className="ml-2 text-[#6066EE]">↩ 이전 데이터로 되돌림</span>}
              </span>
              {(summary.savedTrims > 0 || summary.cleared > 0) && !summary.reverted && (
                <button type="button" onClick={revertBatch} disabled={reverting} className="rounded-lg border border-[#6066EE] px-3 py-1.5 text-xs font-bold text-[#6066EE] hover:bg-[#F0F1FA] disabled:opacity-40">
                  {reverting ? "되돌리는 중…" : "방금 변경 되돌리기"}
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-lg border border-[#E8EAF2] divide-y divide-[#F0F1FA] max-h-72 overflow-y-auto text-sm">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-[#1A1A2E]">{r.vehicle}</span>
                  <span className={r.status === "ok" ? "text-emerald-600" : r.status === "fail" ? "text-[#C0392B]" : "text-[#9BA4C0]"}>
                    {r.status === "ok"
                      ? `${r.savedTrims > 0 ? `✓ 트림 ${r.savedTrims} 저장` : "✓"}${r.cleared ? ` · 미보유 ${r.cleared} 비움` : ""}${r.unmatched && !r.cleared ? ` · 미매칭 ${r.unmatched}` : ""}`
                      : r.status === "fail" ? `실패: ${r.note ?? ""}`
                      : r.note ?? "저장 없음"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showLogin && (
        <ScraperLoginModal
          financeCompanyName={brand ? `${brand} · ${running ? "" : "일괄"} 수집` : "일괄 수집"}
          submitting={running}
          onClose={() => setShowLogin(false)}
          onSubmit={(username, password) => void runBatch(username, password)}
        />
      )}
    </div>
  );
}
