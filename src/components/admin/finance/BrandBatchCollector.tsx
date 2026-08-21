"use client";

import { useMemo, useRef, useState } from "react";
import type { RateSheetRaw } from "@/types/admin";
import type { ScrapeDraft } from "@/types/scraper";
import { RATE_KEYS } from "@/lib/quote-calculator";
import type { PerLineupResult } from "./ScrapeReviewPanel";
import { resolveCapitalConnection } from "@/lib/scraper/connections";
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
  /** 캐피탈사 특성(자동 로그인 가능 여부) 판정용 */
  financeCompanyName: string;
  vehicles: VehicleLite[];
  productType: string;
  onSaved: () => void; // 저장 후 활성시트 갱신
  /** 지정 시 브랜드 선택 없이 이 차량들만 순차 수집한다 (좌측 차량 다중 선택 수집). */
  presetVehicles?: VehicleLite[];
  /**
   * 실행 상태 통지 — preset 모드에서 부모가 차량 선택을 잠그는 데 쓴다.
   * 실행 중 선택이 바뀌면 이 패널이 unmount 되어 진행 표시를 잃는다.
   */
  onRunningChange?: (running: boolean) => void;
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

export default function BrandBatchCollector({ financeCompanyId, financeCompanyName, vehicles, productType, onSaved, presetVehicles, onRunningChange }: Props) {
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
  // 사람 인증 대기(needs_human) — [재개] 버튼을 띄우기 위해 폴링 중 감지한다.
  const [human, setHuman] = useState<{ jobId: string; prompt: string } | null>(null);
  // [중지] 시 서버 잡도 취소하기 위한 현재 잡 id. 안 하면 잡이 needs_human 으로 영영 남는다.
  const activeJobRef = useRef<string | null>(null);

  const connection = resolveCapitalConnection(financeCompanyName);

  const brandVehicles = useMemo(() => vehicles.filter((v) => v.brand === brand), [vehicles, brand]);
  // preset 모드(차량 다중 선택)면 그 차량들, 아니면 브랜드 전체(기존 동작)
  const targetVehicles = presetVehicles ?? brandVehicles;
  const isPreset = presetVehicles !== undefined;
  const weekOf = weekOfMonday();
  const headers = { "Content-Type": "application/json" };

  async function pollJob(jobId: string): Promise<any> {
    activeJobRef.current = jobId;
    const deadline = Date.now() + 30 * 60 * 1000; // 차량당 최대 30분
    try {
      for (;;) {
        if (stopRef.current) return { status: "canceled" };
        if (Date.now() > deadline) return { status: "failed", error: "타임아웃(30분)" };
        await sleep(3000);
        try {
          const data = await (await fetch(`/api/admin/scrape-jobs/${jobId}`)).json();
          const job = data.job;
          if (job && ["completed", "failed", "canceled"].includes(job.status)) return job;
          if (job) {
            setCur((c) => ({ ...c, step: `수집 중 (${job.status})` }));
            // 사람 인증 대기 — [재개] 버튼 노출 (신한·JB 등 헤드풀 로그인 캐피탈사)
            if (job.status === "needs_human") {
              setHuman({ jobId, prompt: job.humanPrompt ?? "워커 브라우저에서 인증을 완료한 뒤 [재개]를 누르세요." });
            } else {
              setHuman(null);
            }
          }
        } catch { /* 일시 오류 무시, 재시도 */ }
      }
    } finally {
      setHuman(null);
      activeJobRef.current = null;
    }
  }

  /** [중지] — 로컬 루프 중단 + 서버의 현재 잡도 취소(안 하면 needs_human 으로 영영 남는다). */
  function stopBatch() {
    stopRef.current = true;
    const id = activeJobRef.current;
    if (id) void fetch(`/api/admin/scrape-jobs/${id}`, { method: "PATCH", headers, body: JSON.stringify({ action: "cancel" }) });
  }

  /** needs_human 잡 재개 — 워커 브라우저에서 인증을 마친 뒤 누른다. */
  function resumeHuman() {
    const id = human?.jobId;
    if (!id) return;
    void fetch(`/api/admin/scrape-jobs/${id}`, { method: "PATCH", headers, body: JSON.stringify({ action: "resume" }) });
    setHuman(null); // 다음 폴링에서 다시 needs_human 이면 재노출된다
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
        memo: isPreset ? "자동 수집(차량 선택)" : "자동 수집(브랜드 일괄)",
      }),
    });
    if (res.ok) return { ok: true };
    let error = `HTTP ${res.status}`;
    try { const j = await res.json(); error = j.error ?? JSON.stringify(j.details ?? j).slice(0, 150); } catch { /* keep status */ }
    return { ok: false, error: `${r.lineupName}: ${error}` };
  }

  async function runBatch(username: string, password: string, workerId: string) {
    if (!financeCompanyId || targetVehicles.length === 0) return;
    setShowLogin(false);

    stopRef.current = false;
    setRunning(true);
    onRunningChange?.(true);
    setResults([]);
    setSummary(null);
    // 되돌리기용 스냅샷: 배치 전 활성 시트(트림→시트id)
    const startSheets: any[] = await (await fetch(`/api/admin/capital-rates?financeCompanyId=${financeCompanyId}`)).json().then((x) => x.data ?? []).catch(() => []);
    const prevActive: Record<string, string> = {};
    for (const s of startSheets) if (s.productType === productType && s.isActive !== false) prevActive[s.trimId] = s.id;
    const touchedTrimIds: string[] = [];
    let okVeh = 0, okTrims = 0, clearedTotal = 0, failVeh = 0;

    const list = targetVehicles;
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
        const createBody = JSON.stringify({ financeCompanyId, productType, weekOf, trimIds, vehicleId: v.id, lineupIds, minVehiclePrice: Math.min(...prices), maxVehiclePrice: Math.max(...prices), username, password, workerId });
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
    onRunningChange?.(false);
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
        <span className="text-sm font-bold text-[#1A1A2E]">
          {isPreset ? (
            <>선택 차량 일괄 수집 <span className="font-normal text-[#9BA4C0]">— 고른 {targetVehicles.length}대의 전 트림 순차 수집·자동 저장</span></>
          ) : (
            <>브랜드 일괄 수집 <span className="font-normal text-[#9BA4C0]">— 한 브랜드 전체 차량 순차 수집·자동 저장</span></>
          )}
        </span>
        <span className="text-[#9BA4C0] text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {/* 카탈로그 전용 캐피탈사(신한 등): 트림 지정 수집이 빈 결과만 내므로 아예 막는다 */}
      {open && connection?.catalogOnly && (
        <div className="px-4 pb-4 border-t border-[#F0F1FA] pt-3">
          <p className="rounded-lg bg-[#FFF7E6] px-3 py-2.5 text-sm text-[#8A6D1F]">
            <b>{financeCompanyName}</b>는 차량·트림 지정 수집을 지원하지 않습니다(사이트 특성상 카탈로그 수집 전용).
            <br />
            <b>캐피탈사 데이터 → 카탈로그 수집</b> 탭에서 브랜드를 고르고 [차량 목록 가져오기] 후 원하는 차량만 골라 수집하세요 —
            로그인 1회로 여러 차량을 한 세션에 수집합니다.
          </p>
        </div>
      )}
      {open && !connection?.catalogOnly && (
        <div className="px-4 pb-4 border-t border-[#F0F1FA] pt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!isPreset && (
              <select value={brand} onChange={(e) => setBrand(e.target.value)} disabled={running || reverting} className="rounded-lg border border-[#D7DBF0] px-3 py-2 text-sm">
                <option value="">브랜드 선택…</option>
                {brands.map((b) => (<option key={b} value={b}>{b} ({vehicles.filter((v) => v.brand === b).length}대)</option>))}
              </select>
            )}
            {!running ? (
              <button type="button" onClick={() => setShowLogin(true)} disabled={targetVehicles.length === 0 || !financeCompanyId || reverting} className="rounded-lg bg-[#6066EE] px-4 py-2 text-sm font-bold text-white hover:bg-[#4F55D8] disabled:opacity-40">
                수집 시작 {targetVehicles.length > 0 && `(${targetVehicles.length}대)`}
              </button>
            ) : (
              <button type="button" onClick={stopBatch} className="rounded-lg border border-[#C0392B] px-4 py-2 text-sm font-bold text-[#C0392B] hover:bg-red-50">중지</button>
            )}
            <span className="text-[11px] text-[#B0B8D0]">워커 실행 중이어야 함 · ORIX 미보유 연식은 &lsquo;데이터 없음&rsquo; 처리(이력 보존){!isPreset && " · 계정 안전상 브랜드 단위 권장"}</span>
          </div>

          {/* 사람 인증 대기 (신한·JB 등 헤드풀 로그인) — 워커 브라우저에서 인증 후 재개 */}
          {human && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-amber-700">✋ {human.prompt}</span>
              <button type="button" onClick={resumeHuman} className="rounded-lg bg-[#6066EE] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#4F55D8]">
                재개
              </button>
            </div>
          )}

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
          financeCompanyName={isPreset ? `선택 차량 ${targetVehicles.length}대 · 일괄 수집` : brand ? `${brand} · ${running ? "" : "일괄"} 수집` : "일괄 수집"}
          requiresHuman={connection?.requiresHuman ?? false}
          submitting={running}
          onClose={() => setShowLogin(false)}
          onSubmit={(username, password, workerId) => void runBatch(username, password, workerId)}
        />
      )}
    </div>
  );
}
