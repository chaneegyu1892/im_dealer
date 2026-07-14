"use client";

import { MessageCircle } from "lucide-react";
import { openChannelTalk } from "@/lib/channel-talk";
import { cn } from "@/lib/utils";

interface ChannelTalkButtonProps {
  vehicleName?: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
  onClick?: () => void;
  loading?: boolean;
}

export function ChannelTalkButton({
  vehicleName,
  label,
  className,
  size = "md",
  onClick,
  loading = false,
}: ChannelTalkButtonProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (!openChannelTalk()) {
      console.warn("채널톡이 로드되지 않았습니다.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-btn font-bold",
        "bg-text-strong text-surface transition-opacity duration-200 hover:opacity-90",
        loading && "cursor-wait opacity-70",
        size === "md" ? "px-6 py-3 text-sm w-full" : "px-4 py-2 text-[13px]",
        className
      )}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : (
        <MessageCircle size={size === "md" ? 16 : 14} />
      )}
      {loading ? "요청 저장 중…" : label ?? (vehicleName ? `${vehicleName} 상담하기` : "전문가와 상담하기")}
    </button>
  );
}
