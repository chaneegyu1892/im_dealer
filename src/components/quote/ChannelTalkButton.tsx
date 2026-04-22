"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChannelTalkButtonProps {
  vehicleName?: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function ChannelTalkButton({
  vehicleName,
  label,
  className,
  size = "md",
}: ChannelTalkButtonProps) {
  const handleClick = () => {
    // 채널톡 오픈 (window.ChannelIO가 로드된 경우)
    if (typeof window !== "undefined" && "ChannelIO" in window) {
      const channelIO = window.ChannelIO as (cmd: string, data?: unknown) => void;

      if (vehicleName) {
        channelIO("openChat", {
          message: `[${vehicleName}] 관련 상담을 원해요.`,
        });
      } else {
        channelIO("openChat");
      }
    } else {
      // 채널톡 미로드 시 fallback: 페이지 하단 채팅 버튼 안내
      console.warn("채널톡이 로드되지 않았습니다.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-btn font-medium",
        "bg-[#1A1A2E] text-white transition-opacity duration-200 hover:opacity-90",
        size === "md" ? "px-6 py-3 text-sm w-full" : "px-4 py-2 text-[13px]",
        className
      )}
    >
      <MessageCircle size={size === "md" ? 16 : 14} />
      {label ?? (vehicleName ? `${vehicleName} 상담하기` : "전문가와 상담하기")}
    </button>
  );
}
