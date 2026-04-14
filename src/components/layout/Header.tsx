"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/recommend", label: "AI 추천" },
  { href: "/cars", label: "차량 탐색" },
  { href: "/about", label: "아임딜러 소개" },
] as const;

export function Header() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
      <div className="page-container">
        <div className="relative flex items-center h-[72px]">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-primary font-semibold text-[20px] tracking-tight">
              아임딜러
            </span>
            <span className="text-[10px] font-semibold text-white bg-primary px-1.5 py-0.5 rounded-[4px] leading-none">
              AI
            </span>
          </Link>

          {/* 데스크톱 네비게이션 — 항상 중앙 고정 */}
          <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative px-5 py-2 rounded-btn text-[14px] transition-colors duration-200",
                    active
                      ? "text-primary font-medium"
                      : "text-ink-body hover:text-primary"
                  )}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
