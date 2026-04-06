"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/recommend", label: "AI 추천" },
  { href: "/cars", label: "차량 탐색" },
  { href: "/quote", label: "견적 계산" },
  { href: "/about", label: "아임딜러 소개" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#F0F0F0]">
      <div className="page-container">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-primary font-semibold text-[18px] tracking-tight">
              아임딜러
            </span>
            <span className="hidden sm:inline-block text-[10px] font-medium text-white bg-primary px-1.5 py-0.5 rounded-[4px]">
              AI
            </span>
          </Link>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-4 py-2 rounded-btn text-sm transition-colors duration-200",
                  pathname === href
                    ? "text-primary font-medium"
                    : "text-neutral-300 hover:text-primary"
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* 데스크톱 CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="primary" size="sm" asChild>
              <Link href="/recommend">AI 견적 시작</Link>
            </Button>
          </div>

          {/* 모바일 메뉴 토글 */}
          <button
            className="md:hidden p-2 text-neutral-300 hover:text-primary transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#F0F0F0] bg-white animate-fade-in">
          <nav className="page-container py-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "px-4 py-3 rounded-btn text-sm transition-colors duration-200",
                  pathname === href
                    ? "text-primary font-medium bg-primary-100"
                    : "text-neutral-300 hover:text-primary hover:bg-neutral-800"
                )}
              >
                {label}
              </Link>
            ))}
            <div className="pt-3 mt-1 border-t border-[#F0F0F0]">
              <Button variant="primary" size="md" fullWidth asChild>
                <Link href="/recommend" onClick={() => setMobileOpen(false)}>
                  AI 견적 시작
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
