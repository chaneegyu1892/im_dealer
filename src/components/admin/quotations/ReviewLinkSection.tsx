"use client";

import { useState } from "react";
import { Copy, Check as CheckIcon, ExternalLink, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateKR } from "@/lib/format";

type CrmStatus = "NEW" | "CONTACTED" | "IN_PROGRESS" | "CONVERTED" | "LOST";

interface ReviewLinkSectionProps {
  quoteId: string;
  status: CrmStatus;
}

export function ReviewLinkSection({ quoteId, status }: ReviewLinkSectionProps) {
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<{ url: string; expiresAt: string; reused: boolean } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = status === "CONVERTED";

  async function handleIssue() {
    setIssuing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/review-token`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error ?? "링크 발급에 실패했습니다.");
        return;
      }
      setIssued(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setIssuing(false);
    }
  }

  async function handleCopy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <section>
      <h4 className="text-[13px] font-bold text-[#1A1A2E] mb-2 flex items-center gap-1.5">
        <MessageSquare size={14} className="text-[#000666]" /> 후기 요청 링크
      </h4>
      <div className="rounded-[10px] border border-[#E8EAF0] overflow-hidden">
        <div className="bg-white p-3 space-y-2">
          {!enabled && (
            <p className="text-[11px] text-[#9BA4C0] leading-relaxed">
              진행 상태를 <span className="font-semibold text-[#059669]">계약완료</span>로 변경하면 발급할 수 있어요.
            </p>
          )}

          {enabled && !issued && (
            <>
              <p className="text-[11px] text-[#9BA4C0] leading-relaxed">
                일회용 링크를 발급해 고객에게 카톡/문자로 전달하세요. 발급 후 30일간 유효합니다.
              </p>
              <button
                onClick={handleIssue}
                disabled={issuing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-semibold bg-[#000666] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <MessageSquare size={11} />
                {issuing ? "발급 중…" : "후기 요청 링크 발급"}
              </button>
            </>
          )}

          {issued && (
            <>
              <p className="text-[11px] text-[#9BA4C0] break-all leading-relaxed">
                {issued.url}
              </p>
              <p className="text-[11px] text-[#6B7399]">
                만료: {formatDateKR(issued.expiresAt)}
                {issued.reused ? " · 기존 미사용 링크 표시" : ""}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium transition-colors",
                    copied
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : "bg-[#F4F5F8] text-[#4A5270] hover:bg-[#E8EAF0] border border-[#E8EAF0]"
                  )}
                >
                  {copied ? (
                    <>
                      <CheckIcon size={11} />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      링크 복사
                    </>
                  )}
                </button>
                <a
                  href={issued.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-medium bg-[#000666] text-white hover:opacity-90 transition-opacity"
                >
                  <ExternalLink size={11} />
                  새 탭으로 열기
                </a>
              </div>
            </>
          )}

          {error && (
            <p className="text-[11px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-[6px] px-2 py-1.5">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
