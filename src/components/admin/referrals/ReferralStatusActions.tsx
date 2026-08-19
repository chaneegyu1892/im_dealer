"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReferralStatus } from "@prisma/client";

// 원장 상태 처리 액션(클라이언트). 서버 데이터는 router.refresh() 로 재취득한다.
// - BLOCKED → "해제": 원장 행을 삭제해 피추천인의 재추천 슬롯을 되돌린다.
// - REWARDED → "철회": 보상 철회(REWARDED → REVOKED).
// REVOKED 는 소급 전이가 없어 액션 없음.

interface ReferralStatusActionsProps {
  referralId: string;
  status: ReferralStatus;
}

export function ReferralStatusActions({ referralId, status }: ReferralStatusActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "REVOKED") {
    return <span className="text-[11px] text-[#9BA4C0]">-</span>;
  }

  const action = status === "BLOCKED" ? "unblock" : "revoke";
  const label = status === "BLOCKED" ? "차단 해제" : "보상 철회";
  const Icon = status === "BLOCKED" ? RotateCcw : Undo2;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/referrals/${referralId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "처리에 실패했습니다.");
      }
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[11px] font-semibold border transition-colors",
            status === "BLOCKED"
              ? "bg-white border-[#E8EAF0] text-[#5A6080] hover:border-[#6066EE] hover:text-[#000666]"
              : "bg-white border-[#E8EAF0] text-[#5A6080] hover:border-[#6066EE] hover:text-[#000666]"
          )}
        >
          <Icon size={11} strokeWidth={2} />
          {label}
        </button>
      ) : (
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="처리 사유(필수)"
              maxLength={200}
              disabled={pending}
              className="w-[180px] px-2 py-1 rounded-[6px] border border-[#E8EAF0] text-[12px] text-[#1A1A2E] placeholder:text-[#9BA4C0] focus:outline-none focus:border-[#6066EE]"
              onKeyDown={(event) => {
                if (event.key === "Enter" && reason.trim() && !pending) void submit();
                if (event.key === "Escape") setOpen(false);
              }}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending || !reason.trim()}
              className="px-2 py-1 rounded-[6px] bg-[#000666] text-white text-[11px] font-semibold disabled:bg-[#6B7399]"
            >
              {pending ? "처리 중" : "확인"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="px-2 py-1 rounded-[6px] bg-white border border-[#E8EAF0] text-[#5A6080] text-[11px]"
            >
              취소
            </button>
          </div>
          {status === "BLOCKED" && (
            <p className="text-[10px] text-[#9BA4C0] max-w-[260px] text-right">
              해제하면 기록이 삭제되고 피추천인이 재추천 가능해집니다. 기록은 감사 로그에
              남습니다.
            </p>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-red-600 max-w-[260px] text-right">{error}</p>}
    </div>
  );
}
