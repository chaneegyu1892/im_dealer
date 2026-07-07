"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutClientProps {
  admin: { id: string; name: string; email: string; role: string };
  children: React.ReactNode;
}

export function AdminLayoutClient({ admin, children }: AdminLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-light-scope h-screen flex bg-[#F4F5F8] overflow-hidden">
      <AdminSidebar
        admin={admin}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 md:ml-[220px] flex flex-col h-full overflow-hidden">
        {/* 모바일 전용 상단 바 */}
        <div className="flex items-center h-12 px-4 bg-white border-b border-[#E8EAF0] md:hidden shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-[6px] text-[#6B7399] hover:bg-[#F4F5F8] transition-colors"
            aria-label="메뉴 열기"
          >
            <Menu size={20} />
          </button>
          <span className="ml-3 text-[14px] font-semibold text-[#1A1A2E]">아임딜러 관리자</span>
        </div>

        <main className="flex-1 min-h-0 p-3 md:p-5 overflow-y-auto scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
}
