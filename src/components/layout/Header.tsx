"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles";

const NAV_LINKS = [
  { href: "/recommend", label: "AI 추천" },
  { href: "/cars", label: "차량 탐색" },
  { href: "/about", label: "아임딜러 소개" },
] as const;

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dbRole, setDbRole] = useState<string | null>(null);
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

  // DB role 은 권한의 단일 출처(SSOT). Supabase 메타가 아니라 /api/me 를 통해 받는다.
  useEffect(() => {
    if (!user) {
      setDbRole(null);
      return;
    }
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) {
          setDbRole(payload?.data?.role ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setDbRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isAdminUser = !!dbRole && (ADMIN_ROLES as readonly string[]).includes(dbRole as AdminRole);

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
    <header className="sticky top-0 z-50 border-b border-public-border bg-white/95 backdrop-blur-xl">
      <div className="page-container">
        <div className="relative flex h-[50px] items-center md:h-[72px]">
          {/* 로고 */}
          <Link href="/" className="flex items-center" aria-label="아임딜러 홈">
            <Image
              src="/images/brand/main-logo.svg"
              alt="아임딜러"
              width={137}
              height={28}
              priority
              unoptimized
              className="h-5 w-auto md:h-7"
            />
          </Link>

          {/* 데스크톱 네비게이션 — md 이상에서만 표시 */}
          <nav className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative px-4 py-2 rounded-xl text-[14px] transition-colors duration-200",
                    active
                      ? "text-brand font-bold bg-brand/[0.06]"
                      : "text-g1 hover:text-brand hover:bg-brand/[0.04]"
                  )}
                >
                  {label}
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
                  className="flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1 transition-colors hover:border-public-border hover:bg-public-bg md:gap-2 md:px-3 md:py-1.5"
                >
                  {avatarUrl ? (
                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full md:h-7 md:w-7">
                      <Image
                        src={avatarUrl}
                        alt={displayName}
                        width={28}
                        height={28}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white md:h-7 md:w-7 md:text-[12px]">
                      {displayName[0]}
                    </div>
                  )}
                  <span className="text-[13px] font-medium text-ink hidden sm:block">
                    {displayName}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-[14px] border border-public-border bg-white py-1 shadow-mobile-float">
                    {isAdminUser && (
                      <Link
                        href="/admin"
                        className="w-full block text-left px-4 py-2.5 text-[13px] text-brand font-bold hover:bg-brand/[0.04] transition-colors border-b border-line"
                      >
                        관리자 콘솔
                      </Link>
                    )}
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
                onClick={(e) => {
                  // 쿼리스트링까지 보존해 로그인 후 정확히 같은 화면으로 복귀
                  // (예: /quote?vehicle=…&restore=1 — pathname 만 담으면 차량 정보가 사라져 /cars 로 튕김)
                  e.preventDefault();
                  const next = window.location.pathname + window.location.search;
                  router.push(`/login?next=${encodeURIComponent(next)}`);
                }}
                className="inline-flex h-8 items-center rounded-full border border-brand/20 px-3 text-[12px] font-bold text-brand transition-colors hover:bg-brand/[0.04] md:h-auto md:rounded-btn md:px-4 md:py-1.5 md:text-[13px]"
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
