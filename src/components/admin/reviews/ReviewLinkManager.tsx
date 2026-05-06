"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check as CheckIcon,
  ExternalLink,
  Trash2,
  Plus,
} from "lucide-react";
import type {
  CustomerSearchResult,
  ReviewRequestTokenSummary,
  ReviewRequestTokenStatus,
} from "@/types/review";
import { CustomerSearchInput } from "./CustomerSearchInput";

interface ReviewLinkManagerProps {
  initialTokens: ReviewRequestTokenSummary[];
}

const STATUS_FILTERS: { value: "all" | ReviewRequestTokenStatus; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unused", label: "미사용" },
  { value: "used", label: "사용됨" },
  { value: "expired", label: "만료" },
  { value: "revoked", label: "무효" },
];

const STATUS_BADGE: Record<ReviewRequestTokenStatus, { label: string; color: string; bg: string }> = {
  unused: { label: "미사용", color: "#059669", bg: "#ECFDF5" },
  used: { label: "사용됨", color: "#6B7399", bg: "#F4F5F8" },
  expired: { label: "만료", color: "#D97706", bg: "#FFFBEB" },
  revoked: { label: "무효", color: "#DC2626", bg: "#FEF2F2" },
};

export function ReviewLinkManager({ initialTokens }: ReviewLinkManagerProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ReviewRequestTokenStatus>("all");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [copyToken, setCopyToken] = useState<string | null>(null);

  const tokens = useMemo(() => {
    if (filter === "all") return initialTokens;
    return initialTokens.filter((t) => t.status === filter);
  }, [initialTokens, filter]);

  async function handleIssue() {
    if (!selectedCustomer) return;
    if (selectedCustomer.status !== "CONVERTED") {
      setIssueError("계약완료(CONVERTED) 상태의 견적에서만 발급할 수 있습니다.");
      return;
    }
    setIssuing(true);
    setIssueError(null);
    try {
      const res = await fetch(
        `/api/admin/quotes/${selectedCustomer.savedQuoteId}/review-token`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setIssueError(json?.error ?? "링크 발급에 실패했습니다.");
        return;
      }
      setSelectedCustomer(null);
      router.refresh();
    } catch {
      setIssueError("네트워크 오류가 발생했습니다.");
    } finally {
      setIssuing(false);
    }
  }

  async function handleRevoke(token: string) {
    if (!confirm("이 링크를 무효화하시겠습니까? 이후로 고객이 사용할 수 없게 됩니다.")) return;
    try {
      const res = await fetch(`/api/admin/review-tokens/${token}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "무효화 실패");
        return;
      }
      router.refresh();
    } catch {
      alert("네트워크 오류");
    }
  }

  async function handleCopy(token: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyToken(token);
      setTimeout(() => setCopyToken(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FC] p-5 space-y-4">
      <div className="bg-white rounded-[10px] border border-[#E8EAF2] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-[#000666]" />
          <p className="text-[13px] font-semibold text-[#1A1A2E]">새 링크 발급</p>
        </div>
        <p className="text-[12px] text-[#6B7399] leading-relaxed">
          계약완료(CONVERTED) 상태의 견적을 검색해 후기 요청 링크를 발급하세요. 30일간 유효한 일회용 링크가 만들어집니다.
        </p>

        <CustomerSearchInput
          selected={selectedCustomer}
          onSelect={setSelectedCustomer}
          onClear={() => setSelectedCustomer(null)}
        />

        {selectedCustomer && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12px] text-[#6B7399]">
              상태:{" "}
              <span
                className={
                  selectedCustomer.status === "CONVERTED"
                    ? "text-[#059669] font-semibold"
                    : "text-[#D97706] font-semibold"
                }
              >
                {selectedCustomer.statusLabel || selectedCustomer.status}
              </span>
            </div>
            <button
              type="button"
              onClick={handleIssue}
              disabled={issuing || selectedCustomer.status !== "CONVERTED"}
              className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-[#000666] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {issuing ? "발급 중…" : "링크 발급"}
            </button>
          </div>
        )}

        {issueError && (
          <p className="text-[12px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-3 py-2">
            {issueError}
          </p>
        )}
      </div>

      <div className="bg-white rounded-[10px] border border-[#E8EAF2]">
        <div className="px-5 py-3 border-b border-[#E8EAF2] flex items-center justify-between">
          <p className="text-[13px] font-semibold text-[#1A1A2E]">요청 링크 목록</p>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={
                  "px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors " +
                  (filter === f.value
                    ? "bg-[#000666] text-white"
                    : "text-[#6B7399] hover:bg-[#F4F5F8]")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {tokens.length === 0 ? (
          <div className="p-8 text-center text-[12px] text-[#9BA4C0]">
            표시할 링크가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {tokens.map((t) => {
              const badge = STATUS_BADGE[t.status];
              const expiresAt = new Date(t.expiresAt);
              return (
                <div key={t.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[13px] font-medium text-[#1A1A2E]">
                        {t.customerName ?? "이름 없음"}
                      </span>
                      <span className="text-[12px] text-[#6B7399]">
                        {t.vehicleName ?? "차량 미상"}
                      </span>
                      {t.customerPhoneMasked && (
                        <span className="text-[11px] text-[#9BA4C0]">
                          {t.customerPhoneMasked}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#9BA4C0] break-all">{t.url}</p>
                    <p className="text-[11px] text-[#9BA4C0]">
                      발급 {formatShortDate(t.createdAt)} · 만료 {formatShortDate(t.expiresAt)}
                      {t.usedAt ? ` · 사용 ${formatShortDate(t.usedAt)}` : ""}
                      {t.revokedAt ? ` · 무효 ${formatShortDate(t.revokedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(t.token, t.url)}
                      className={
                        "flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium transition-colors " +
                        (copyToken === t.token
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : "bg-[#F4F5F8] text-[#4A5270] hover:bg-[#E8EAF0] border border-[#E8EAF0]")
                      }
                    >
                      {copyToken === t.token ? (
                        <>
                          <CheckIcon size={11} /> 복사됨
                        </>
                      ) : (
                        <>
                          <Copy size={11} /> 복사
                        </>
                      )}
                    </button>
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium text-[#4A5270] bg-[#F4F5F8] hover:bg-[#E8EAF0] border border-[#E8EAF0]"
                    >
                      <ExternalLink size={11} /> 열기
                    </a>
                    {t.status === "unused" && expiresAt.getTime() > Date.now() && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(t.token)}
                        className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-medium text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FCE7E7] border border-[#FECACA]"
                      >
                        <Trash2 size={11} /> 무효
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}
