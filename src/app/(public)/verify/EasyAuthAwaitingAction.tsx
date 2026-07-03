"use client";

import { useEffect, useState } from "react";
import { Info, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const EASY_AUTH_CONFIRM_DELAY_MS = 3_000;

interface EasyAuthAwaitingActionProps {
  readonly docLabel: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
}

export function EasyAuthAwaitingAction({
  docLabel,
  busy,
  onConfirm,
}: EasyAuthAwaitingActionProps) {
  const [isDelayComplete, setIsDelayComplete] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setIsDelayComplete(true);
    }, EASY_AUTH_CONFIRM_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, []);

  const canConfirm = isDelayComplete && !busy;

  return (
    <div className="rounded-[14px] border border-primary/20 bg-primary/[0.05] p-4 text-center">
      <Smartphone size={28} className="mx-auto mb-2 text-primary" />
      <p className="text-[13px] font-medium text-ink">{docLabel} 인증 대기 중</p>
      <p className="mb-3 mt-1 text-[12px] text-public-muted">
        휴대폰에서 인증을 완료하세요 (4분 30초 내)
      </p>

      <div
        id="easy-auth-confirm-guidance"
        className="mb-3 flex items-start gap-2 rounded-[12px] border border-primary/15 bg-white/80 px-3 py-2.5 text-left"
        role="status"
        aria-live="polite"
      >
        <Info size={15} className="mt-0.5 shrink-0 text-primary" />
        <p className="break-keep text-[12px] font-medium leading-relaxed text-ink-label">
          알림을 확인하고 인증을 진행하고 나서 인증 완료 버튼을 눌러주세요.
        </p>
      </div>

      <Button
        type="button"
        variant="primary"
        size="md"
        fullWidth
        disabled={!canConfirm}
        onClick={onConfirm}
        aria-describedby="easy-auth-confirm-guidance"
        className="min-h-[48px] rounded-[12px] font-semibold"
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> 확인 중...
          </span>
        ) : (
          "인증을 완료했어요"
        )}
      </Button>
    </div>
  );
}
