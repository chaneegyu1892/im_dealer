"use client";

import { useMemo, useState } from "react";
import { resolveCapitalConnection } from "@/lib/scraper/connections";
import { brandsForAdapter } from "@/lib/scraper/capital-brands";
import ScraperLoginModal from "../ScraperLoginModal";
import WorkerStatusBadge from "../WorkerStatusBadge";
import type { CatalogJobState } from "./CapitalCatalogManager";

interface Props {
  financeCompanyId: string;
  financeCompanyName: string;
  productType: string;
  job: CatalogJobState;
  onJobStarted: (jobId: string) => void;
}

function weekOfMonday(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().slice(0, 10);
}

const RUNNING_STATES = ["pending", "running", "needs_human"];

/** 카탈로그 수집 — 브랜드 선택 → 개인 로그인 입력 → 잡 생성 → 진행률 표시. */
export default function CatalogScrapePanel({ financeCompanyId, financeCompanyName, productType, job, onJobStarted }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showLogin, setShowLogin] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 선택된 캐피탈사의 어댑터 → 카탈로그 브랜드 목록
  const brandOptions = useMemo(
    () => brandsForAdapter(resolveCapitalConnection(financeCompanyName)?.adapter),
    [financeCompanyName]
  );

  const isRunning = !!job.status && RUNNING_STATES.includes(job.status);
  const toggle = (brandCd: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(brandCd)) next.delete(brandCd);
      else next.add(brandCd);
      return next;
    });
  };

  const start = async (username: string, password: string) => {
    const brands = brandOptions.filter((b) => selected.has(b.brandCd));
    if (brands.length === 0) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/admin/scrape-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "catalog",
          financeCompanyId,
          productType,
          weekOf: weekOfMonday(),
          brands,
          username,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.jobId) {
        // 이미 진행 중인 잡 — 그 잡을 이어서 지켜본다
        setShowLogin(false);
        onJobStarted(data.jobId);
        return;
      }
      if (!res.ok || !data.jobId) {
        setStartError(data.error ?? "수집 작업 생성에 실패했습니다.");
        return;
      }
      setShowLogin(false);
      onJobStarted(data.jobId);
    } finally {
      setStarting(false);
    }
  };

  const patchJob = async (action: "cancel" | "resume") => {
    if (!job.jobId) return;
    await fetch(`/api/admin/scrape-jobs/${job.jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  };

  const p = job.progress;
  const pct = p && p.trimsTotal > 0 ? Math.min(100, Math.round((p.trimsDone / p.trimsTotal) * 100)) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 브랜드 선택 */}
      <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-[#1A1A2E]">
            브랜드 전량 수집
            <span className="ml-2 font-normal text-xs text-[#9BA4C0]">
              선택한 브랜드의 {financeCompanyName} 등록 전 모델·전 트림을 원본 그대로 수집합니다
            </span>
          </p>
          <WorkerStatusBadge />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {brandOptions.map((b) => (
            <label
              key={b.brandCd}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                selected.has(b.brandCd)
                  ? "border-[#6066EE] bg-[#F0F1FA] text-[#3A41C8] font-semibold"
                  : "border-[#E8EAF2] text-[#5A6080] hover:border-[#C9CEEA]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(b.brandCd)}
                onChange={() => toggle(b.brandCd)}
                disabled={isRunning}
                className="h-3.5 w-3.5 accent-[#6066EE]"
              />
              {b.name}
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowLogin(true)}
            disabled={selected.size === 0 || isRunning || starting}
            className="rounded-lg bg-[#6066EE] px-4 py-2 text-sm font-bold text-white hover:bg-[#4F55D8] disabled:opacity-40"
          >
            수집 시작 {selected.size > 0 && `(브랜드 ${selected.size}개)`}
          </button>
          <span className="text-[11px] text-[#B0B8D0]">
            워커 실행 중이어야 함 · 트림당 약 15~25초, 브랜드당 수십 분~수 시간 — 브랜드 1~2개씩 권장 · 중단해도 수집분은 저장되고 같은 주엔 이어서 수집
          </span>
        </div>
        {startError && <p className="mt-2 text-xs font-medium text-red-500">{startError}</p>}
      </div>

      {/* 진행/결과 카드 */}
      {job.jobId && (
        <div className="bg-white rounded-2xl border border-[#E8EAF0] shadow-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[#1A1A2E]">
              {job.status === "completed" && "✅ 수집 완료"}
              {job.status === "failed" && "❌ 수집 실패"}
              {job.status === "canceled" && "⏹ 취소됨"}
              {job.status === "needs_human" && "✋ 확인 필요"}
              {(job.status === "pending" || job.status === "running") && "⏳ 수집 중…"}
            </p>
            <div className="flex gap-2">
              {job.status === "needs_human" && (
                <button type="button" onClick={() => patchJob("resume")} className="rounded-lg bg-[#6066EE] px-3 py-1.5 text-xs font-bold text-white">
                  재개
                </button>
              )}
              {isRunning && (
                <button
                  type="button"
                  onClick={() => patchJob("cancel")}
                  title="지금까지 수집분은 저장됩니다"
                  className="rounded-lg border border-[#C0392B] px-3 py-1.5 text-xs font-bold text-[#C0392B] hover:bg-red-50"
                >
                  취소
                </button>
              )}
            </div>
          </div>

          {job.humanPrompt && <p className="mt-2 text-xs text-amber-600">{job.humanPrompt}</p>}
          {job.error && <p className="mt-2 text-xs text-red-500">{job.error}</p>}

          {isRunning && p && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-[#5A6080]">
                <span>
                  브랜드 {p.brandIdx}/{p.brandCount} <b>{p.brandName}</b> · 모델 {p.modelIdx}/{p.modelCount} <b>{p.modelName}</b>
                </span>
                <span>
                  트림 {p.trimsDone}/{p.trimsTotal}
                  {p.skipped > 0 && ` (기수집 ${p.skipped} 스킵)`}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-[#F0F1FA] overflow-hidden">
                <div className="h-full rounded-full bg-[#6066EE] transition-all" style={{ width: `${pct ?? 5}%` }} />
              </div>
            </div>
          )}
          {isRunning && !p && <p className="mt-2 text-xs text-[#9BA4C0]">워커 클레임 대기 중… (워커가 꺼져 있으면 시작되지 않습니다)</p>}

          {job.status === "completed" && job.summary && (
            <p className="mt-2 text-xs text-[#5A6080]">
              트림 <b>{job.summary.total}</b>건 수집 · 기수집 스킵 {job.summary.skipped}건 · 실패 {job.summary.failed}건
              {job.summary.brands.length > 0 && (
                <span className="ml-2 text-[#9BA4C0]">({job.summary.brands.map((b) => `${b.name} ${b.trims}`).join(" · ")})</span>
              )}
              <span className="ml-2 text-emerald-600 font-semibold">→ 카탈로그 열람·매핑 탭에서 확인하세요</span>
            </p>
          )}
        </div>
      )}

      {showLogin && (
        <ScraperLoginModal
          financeCompanyName={financeCompanyName}
          requiresHuman={resolveCapitalConnection(financeCompanyName)?.requiresHuman ?? false}
          submitting={starting}
          onClose={() => setShowLogin(false)}
          onSubmit={(u, pw) => void start(u, pw)}
        />
      )}
    </div>
  );
}
