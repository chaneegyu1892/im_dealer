"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { openChannelTalk } from "@/lib/channel-talk";

export function ChannelTalkFAB() {
  const pathname = usePathname() ?? "";

  if (pathname === "/") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={openChannelTalk}
      aria-label="채널톡 상담하기"
      className="fixed bottom-6 right-6 z-50 hidden min-h-11 items-center gap-2.5 rounded-pill bg-brand px-5 py-3.5 text-white shadow-float transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] md:flex"
    >
      <MessageCircle size={20} strokeWidth={2} />
      <span className="text-[14px] font-semibold">상담하기</span>
    </button>
  );
}
