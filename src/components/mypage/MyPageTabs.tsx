"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MyPageTab {
  href: string;
  label: string;
  exact: boolean;
}

/** 마이 영역 전용 탭 — 각 기능은 독립 페이지 */
const TABS: MyPageTab[] = [
  { href: "/mypage", label: "홈", exact: true },
  { href: "/mypage/quotes", label: "내 견적", exact: false },
  { href: "/mypage/coupons", label: "쿠폰함", exact: false },
  { href: "/mypage/referral", label: "추천인", exact: false },
  { href: "/mypage/profile", label: "내 정보", exact: false },
];

export function MyPageTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="마이페이지 메뉴" className="mb-6 md:mb-8">
      <ul className="grid grid-cols-5 gap-0.5 rounded-[13px] bg-surface-soft p-1 max-[360px]:gap-0">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-center rounded-[10px] px-0.5 text-[12px] font-bold transition-colors sm:text-[13px] md:text-[14px]",
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
