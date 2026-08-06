"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MyPageTab {
  href: string;
  label: string;
  exact: boolean;
}

const TABS: MyPageTab[] = [
  { href: "/mypage", label: "홈", exact: true },
  { href: "/mypage/coupons", label: "쿠폰함", exact: false },
];

export function MyPageTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="마이페이지 메뉴" className="mb-6 md:mb-8">
      <ul className="grid grid-cols-2 gap-1 rounded-[13px] bg-surface-soft p-1">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-[10px] text-[14px] font-bold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  active
                    ? "border border-border-strong bg-surface text-text-strong shadow-card"
                    : "border border-transparent text-text-body hover:bg-surface hover:text-text-strong"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
