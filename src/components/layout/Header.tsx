"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/recommend", label: "AI 추천" },
  { href: "/cars", label: "차량 탐색" },
  { href: "/quote", label: "견적 계산" },
  { href: "/about", label: "아임딜러 소개" },
] as const;

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
      <div className="page-container">
        <div className="flex items-center justify-between h-[72px]">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-primary font-semibold text-[20px] tracking-tight">
              아임딜러
            </span>
            <span className="text-[10px] font-semibold text-white bg-primary px-1.5 py-0.5 rounded-[4px] leading-none">
              AI
            </span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative px-5 py-2 rounded-btn text-[14px] transition-colors duration-200",
                    isActive
                      ? "text-primary font-medium"
                      : "text-ink-body hover:text-primary"
                  )}
                >
                  {label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* CTA */}
          <Button variant="primary" size="sm" asChild>
            <Link href="/recommend">AI 견적 시작</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
