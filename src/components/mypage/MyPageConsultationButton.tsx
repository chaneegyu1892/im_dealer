"use client";

import { ChannelTalkButton } from "@/components/quote/ChannelTalkButton";
import { openChannelTalkWithQuote } from "@/lib/channel-talk";

interface MyPageConsultationButtonProps {
  quoteId: string;
  sessionId: string;
  vehicleName: string;
  trimName: string;
  productType: "장기렌트" | "리스";
  contractMonths: number;
  annualMileage: number;
  label?: string;
  className?: string;
}

export function MyPageConsultationButton({
  quoteId,
  sessionId,
  vehicleName,
  trimName,
  productType,
  contractMonths,
  annualMileage,
  label,
  className,
}: MyPageConsultationButtonProps) {
  return (
    <ChannelTalkButton
      vehicleName={vehicleName}
      label={label ?? "상담 이어가기"}
      size="sm"
      className={className}
      onClick={() => {
        openChannelTalkWithQuote({
          quoteId,
          sessionId,
          vehicleName,
          trimName,
          productType,
          contractMonths,
          annualMileage,
        });
      }}
    />
  );
}
