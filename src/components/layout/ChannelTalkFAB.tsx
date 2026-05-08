"use client";

import { MessageCircle } from "lucide-react";

export function ChannelTalkFAB() {
  const handleClick = () => {
    if (typeof window !== "undefined" && window.ChannelIO) {
      window.ChannelIO("openChat");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="채널톡 상담하기"
      className="hidden md:flex fixed bottom-6 right-6 z-50 items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-full shadow-lg bg-[#1A1A2E] text-white hover:bg-[#2A2A4E] active:scale-95 transition-all duration-200"
    >
      <MessageCircle size={20} strokeWidth={2} />
      <span className="text-[14px] font-semibold">상담하기</span>
    </button>
  );
}
