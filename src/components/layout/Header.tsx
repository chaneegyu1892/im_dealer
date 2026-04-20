"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/recommend", label: "AI 추천" },
  { href: "/cars", label: "차량 탐색" },
  { href: "/about", label: "아임딜러 소개" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setDropdownOpen(false);
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const displayName =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "고객";

  const avatarUrl =
    user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? null;

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

          {/* 우측: 로그인 상태 */}
          <div className="ml-auto">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full px-3 py-1.5 hover:bg-neutral transition-colors"
                >
                  {avatarUrl ? (
                    <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-white text-[12px] font-semibold">
                      {displayName[0]}
                    </div>
                  )}
                  <span className="text-[13px] font-medium text-ink hidden sm:block">
                    {displayName}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-[#F0F0F0] rounded-xl shadow-lg py-1 z-50">
                    <Link
                      href="/admin"
                      className="w-full block text-left px-4 py-2.5 text-[13px] text-primary font-medium hover:bg-primary/[0.04] transition-colors border-b border-[#F0F0F0]"
                    >
                      관리자 콘솔
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-[13px] text-ink-label hover:text-ink hover:bg-neutral transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="text-[13px] font-medium text-primary border border-primary/30 rounded-btn px-4 py-1.5 hover:bg-primary/[0.04] transition-colors"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
