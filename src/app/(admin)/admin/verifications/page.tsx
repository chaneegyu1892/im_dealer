'use client';

import { useState, useEffect } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Clock, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { VerificationResult } from "@/components/admin/VerificationResult";
import type { AdminVerification } from "@/lib/admin-queries";

// ─── 고객 유형 ────────────────────────────────────────────
const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  individual: "직장인",
  self_employed: "개인사업자",
  corporate: "법인",
};

// ─── 상태 뱃지 ───────────────────────────────────────────
function StatusDot({ ok, pending }: { ok: boolean; pending: boolean }) {
  if (pending) return <span className="w-2 h-2 rounded-full bg-[#D0D5E8] inline-block" />;
  return ok
    ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
    : <XCircle size={13} className="text-red-400 shrink-0" />;
}

// ─── 날짜 포맷 ───────────────────────────────────────────
function fmtDateTime(d: Date | string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

// ─── 메인 ────────────────────────────────────────────────
export default function VerificationsPage() {
  const [rows, setRows] = useState<AdminVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminVerification | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/verifications");
      if (res.ok) {
        const json = await res.json() as { data: AdminVerification[] };
        setRows(json.data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="flex h-full">
      {/* ── 목록 ── */}
      <div className={cn("flex flex-col flex-1 min-w-0", selected && "border-r border-[#E8EAF0]")}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAF0] bg-white">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#6066EE]" />
            <h1 className="text-[15px] font-semibold text-[#1A1A2E]">서류 확인</h1>
            <span className="text-[12px] text-[#9BA4C0] ml-1">최근 {rows.length}건</span>
          </div>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 text-[12px] text-[#9BA4C0] hover:text-[#6066EE] transition-colors"
          >
            <RefreshCw size={12} />
            새로고침
          </button>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_24px] gap-3 px-6 py-2.5 bg-[#F8F9FC] border-b border-[#E8EAF0] text-[11px] font-semibold text-[#9BA4C0] uppercase tracking-wide">
          <span>세션 ID</span>
          <span>고객 유형</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={10} />운전면허</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={10} />건강보험</span>
          <span className="flex items-center gap-1"><CheckCircle2 size={10} />사업자</span>
          <span />
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-[13px] text-[#9BA4C0]">
              <div className="w-4 h-4 rounded-full border-2 border-[#000666] border-t-transparent animate-spin mr-2" />
              불러오는 중...
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-[#9BA4C0]">
              <Clock size={32} className="mb-3 opacity-40" />
              <p className="text-[13px]">제출된 서류가 없습니다.</p>
            </div>
          )}
          {!loading && rows.map((row) => {
            const isPending = row.verifiedAt === null;
            const isSelected = selected?.id === row.id;
            return (
              <button
                key={row.id}
                onClick={() => setSelected(isSelected ? null : row)}
                className={cn(
                  "w-full grid grid-cols-[2fr_1fr_1fr_1fr_1fr_24px] gap-3 px-6 py-3.5 border-b border-[#F0F2F8]",
                  "text-left hover:bg-[#F8F9FC] transition-colors",
                  isSelected && "bg-primary/[0.04] border-l-2 border-l-[#000666]"
                )}
              >
                <div>
                  <p className="text-[12px] font-mono text-[#1A1A2E]">{row.sessionId.slice(0, 8)}…</p>
                  <p className="text-[11px] text-[#9BA4C0] mt-0.5">{fmtDateTime(row.createdAt)}</p>
                </div>
                <span className="text-[12px] text-[#4A5270] self-center">
                  {CUSTOMER_TYPE_LABEL[row.customerType] ?? row.customerType}
                </span>
                <span className="self-center">
                  <StatusDot ok={row.licenseVerified} pending={isPending} />
                </span>
                <span className="self-center">
                  {row.customerType === "individual" || row.customerType === "self_employed"
                    ? <StatusDot ok={row.insuranceVerified} pending={isPending} />
                    : <span className="text-[11px] text-[#C0C5DC]">—</span>}
                </span>
                <span className="self-center">
                  {row.customerType === "self_employed" || row.customerType === "corporate"
                    ? <StatusDot ok={row.bizVerified} pending={isPending} />
                    : <span className="text-[11px] text-[#C0C5DC]">—</span>}
                </span>
                <ChevronRight size={14} className={cn("text-[#C0C5DC] self-center transition-transform", isSelected && "rotate-90")} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 상세 패널 ── */}
      {selected && (
        <div className="w-[360px] shrink-0 overflow-y-auto bg-white">
          <div className="px-5 py-4 border-b border-[#E8EAF0]">
            <p className="text-[13px] font-semibold text-[#1A1A2E]">서류 확인 결과</p>
            <p className="text-[11px] text-[#9BA4C0] mt-0.5 font-mono">{selected.sessionId}</p>
          </div>
          <div className="p-5">
            <VerificationResult sessionId={selected.sessionId} />
          </div>
        </div>
      )}
    </div>
  );
}
