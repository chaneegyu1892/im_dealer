"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  Car,
  Package,
  Sparkles,
  BarChart2,
  Building2,
  Settings,
  ClipboardList,
  LogOut,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string;
  roles?: string[]; // 해당 메뉴를 볼 수 있는 역할들 (없으면 전체 공개)
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
      { href: "/admin/vehicles", label: "차량 관리", icon: Car, roles: ["admin", "staff"] },
      { href: "/admin/quotations", label: "견적 데이터", icon: FileText, roles: ["admin", "staff", "dealer"] },
      { href: "/admin/users", label: "사용자 관리", icon: Users, roles: ["admin", "staff", "dealer"] },
      { href: "/admin/inventory", label: "재고관리", icon: Package, roles: ["admin", "staff"] },
    ],
  },
  {
    group: "정책 및 AI",
    items: [
      { href: "/admin/finance", label: "견적 산출 로직 관리", icon: Building2, roles: ["admin"] },
      { href: "/admin/ai", label: "AI관리", icon: Sparkles, roles: ["admin"] },
    ],
  },
  {
    group: "시스템",
    items: [
      { href: "/admin/memo", label: "운영 메모", icon: ClipboardList, roles: ["admin", "staff"] },
      { href: "/admin/settings", label: "설정", icon: Settings, roles: ["admin"] },
    ],
  },
];

export function AdminSidebar({ admin }: { admin: any }) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  // 역할에 따른 메뉴 필터링
  const filteredNav = NAV.map(section => ({
    ...section,
    items: section.items.filter(item => 
      !item.roles || item.roles.includes(admin?.role)
    )
  })).filter(section => section.items.length > 0);

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
        {filteredNav.map((section, si) => (
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
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-[6px] mb-1">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
            style={{ background: "#000666" }}
          >
            관
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#C0C5DC] truncate">{admin?.name || "관리자"}</p>
            <p className="text-[10px] text-[#3D4470] truncate">{admin?.email}</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-2.5 py-1.5 w-full rounded-[6px] text-[12px] text-[#3D4470] hover:text-[#8890AA] hover:bg-white/[0.04] transition-all duration-150">
          <LogOut size={12} strokeWidth={1.8} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
