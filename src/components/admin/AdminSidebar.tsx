"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Car,
  BarChart2,
  LogOut,
  ShieldCheck,
  Settings,
  ChevronUp,
  Users,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
}

interface NavGroup {
  group: string | null;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: null,
    items: [
      { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
      { href: "/admin/analytics", label: "데이터 분석", icon: BarChart2 },
    ],
  },
  {
    group: "핵심 관리",
    items: [
      { href: "/admin/quotations", label: "견적 데이터", icon: FileText },
      { href: "/admin/verifications", label: "서류 확인", icon: ShieldCheck },
      { href: "/admin/vehicles", label: "차량 관리", icon: Car },
    ],
  },
];

interface AdminInfo {
  name: string;
  email: string;
  role: string;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.success) setAdminInfo(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const initial = adminInfo?.name?.[0] ?? "관";

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[220px] flex flex-col z-50 select-none"
      style={{
        background: "#0D0D1F",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <Link href="/admin" className="flex items-center gap-2 group">
          <span className="text-white font-semibold text-[16px] tracking-tight group-hover:opacity-90 transition-opacity">
            아임딜러
          </span>
          <span className="text-[9px] font-semibold text-[#000666] bg-[#6066EE] px-1.5 py-0.5 rounded-[3px] leading-none">
            ADMIN
          </span>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {NAV.map((section, si) => (
          <div key={si} className={cn(si > 0 && "mt-5")}>
            {section.group && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3D4470] px-2 mb-1.5">
                {section.group}
              </p>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href, item.exact);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-[6px] text-[13px] font-medium",
                    "transition-all duration-150 relative group",
                    active
                      ? "bg-[#1A1A3E] text-white border-l-2 border-[#000666] pl-[9px]"
                      : "text-[#5A6080] hover:text-[#9BA4C0] hover:bg-white/[0.04]"
                  )}
                >
                  <Icon
                    size={14}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-[#6066EE]" : "text-current"}
                  />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] font-semibold bg-[#1E2040] text-[#6066EE] px-1.5 py-0.5 rounded-[4px]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* 하단 유저 영역 */}
      <div className="px-3 py-4 border-t border-white/[0.06]" ref={popupRef}>
        {/* 팝업 */}
        {popupOpen && (
          <div className="mb-2 bg-[#1A1A3E] rounded-[8px] border border-white/[0.08] overflow-hidden">
            <Link
              href="/admin/settings"
              onClick={() => setPopupOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-[#9BA4C0] hover:text-white hover:bg-white/[0.06] transition-all duration-150"
            >
              <Settings size={13} strokeWidth={1.8} />
              계정 설정
            </Link>
            {adminInfo?.role === "admin" && (
              <>
                <Link
                  href="/admin/settings/accounts"
                  onClick={() => setPopupOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-[#9BA4C0] hover:text-white hover:bg-white/[0.06] transition-all duration-150"
                >
                  <Users size={13} strokeWidth={1.8} />
                  계정 관리
                </Link>
                <div className="h-px bg-white/[0.06]" />
              </>
            )}
            <div className="h-px bg-white/[0.06]" />
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2.5 w-full text-left text-[12px] text-[#5A6080] hover:text-red-400 hover:bg-white/[0.04] transition-all duration-150"
            >
              <LogOut size={13} strokeWidth={1.8} />
              로그아웃
            </button>
          </div>
        )}

        {/* 유저 버튼 */}
        <button
          type="button"
          onClick={() => setPopupOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2.5 px-2 py-2 rounded-[6px] w-full transition-all duration-150",
            popupOpen ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
          )}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
            style={{ background: "#000666" }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[12px] font-medium text-[#C0C5DC] truncate">
              {adminInfo?.name ?? "관리자"}
            </p>
            <p className="text-[10px] text-[#3D4470] truncate">
              {adminInfo?.email ?? ""}
            </p>
          </div>
          <ChevronUp
            size={12}
            className={cn(
              "text-[#3D4470] shrink-0 transition-transform duration-150",
              popupOpen ? "rotate-0" : "rotate-180"
            )}
          />
        </button>
      </div>
    </aside>
  );
}
