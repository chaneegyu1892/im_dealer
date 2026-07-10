"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CarFront, ClipboardCheck, Home, Info, MessageCircle, UserRound } from "lucide-react";
import { openChannelTalk } from "@/lib/channel-talk";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles";

const NAV_LINKS = [
  { href: "/", label: "홈", icon: Home, exact: true },
  { href: "/recommend", label: "AI 추천", icon: ClipboardCheck, exact: false },
  { href: "/cars", label: "차량 탐색", icon: CarFront, exact: false },
  { href: "/about", label: "소개", icon: Info, exact: false },
] as const;

export function Header() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const router = useRouter();

  // 견적 플로우는 전용 미니 헤더(STEP/진행바)를 모바일에서 쓰므로,
  // 사이트 헤더와 겹쳐 단계 표시가 가려지는 문제를 막기 위해 모바일에서만 숨긴다.
  // 데스크톱은 견적 미니 헤더가 md:hidden 이라 사이트 헤더를 그대로 노출해 로그인·네비 유지.
  if (pathname.startsWith("/quote")) {
    return <div className="h-0 md:hidden" aria-hidden />;
  }
  const [user, setUser] = useState<User | null>(null);
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) {
        setDbRole(null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setDbRole(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // DB role 은 권한의 단일 출처(SSOT). Supabase 메타가 아니라 /api/me 를 통해 받는다.
  useEffect(() => {
    if (!user) {
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
    setDbRole(null);
    setDropdownOpen(false);
    router.refresh();
  }

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
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
    <header className={cn(
      "sticky top-0 z-50 border-b border-border-subtle bg-surface-glass backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150",
      isHome && "home-showroom-scope"
    )}>
      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-5 lg:px-8">
        <div className="relative flex h-14 items-center lg:h-[72px]">
          {/* 로고 */}
          <Link
            href="/"
            className="flex min-h-11 items-center rounded-btn focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label="아임딜러 홈"
          >
            <Image
              src="/images/brand/main-logo.svg"
              alt="아임딜러"
              width={137}
              height={28}
              priority
              loading="eager"
              unoptimized
              className="block h-5 w-[98px] object-contain lg:h-7 lg:w-[137px]"
            />
          </Link>

          {/* 데스크톱 네비게이션 — 하단 앱 탭과 같은 모델 */}
          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-pill border border-border-subtle bg-surface-soft p-1 lg:flex"
            aria-label="주요 메뉴"
          >
            {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "relative inline-flex min-h-11 items-center gap-2 rounded-pill px-4 text-[14px] font-bold transition-all duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]",
                    active
                      ? "bg-surface text-brand shadow-card"
                      : "text-text-body hover:bg-surface hover:text-text-strong"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                  {label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={openChannelTalk}
              className="inline-flex min-h-11 items-center gap-2 rounded-pill px-4 text-[14px] font-bold text-text-body transition-all duration-state hover:bg-surface hover:text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
            >
              <MessageCircle size={17} strokeWidth={2} />
              상담
            </button>
          </nav>

          {/* 우측: 로그인 상태 */}
          <div className="ml-auto">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex min-h-11 items-center gap-1.5 rounded-pill border border-transparent px-2 py-1 text-text-strong transition-colors hover:border-border-subtle hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface md:gap-2 md:px-3"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
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
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">
                      {displayName[0] ?? <UserRound size={15} strokeWidth={2.2} />}
                    </div>
                  )}
                  <span className="hidden max-w-[8rem] truncate text-[13px] font-bold text-text-strong sm:block">
                    {displayName}
                  </span>
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-card border border-border-subtle bg-surface-raised py-1 shadow-mobile-float"
                    role="menu"
                  >
                    {isAdminUser && (
                      <Link
                        href="/admin"
                        className="block min-h-11 w-full px-4 py-3 text-left text-[13px] font-bold text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
                        role="menuitem"
                      >
                        관리자 콘솔
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="min-h-11 w-full px-4 py-3 text-left text-[13px] font-semibold text-text-body transition-colors hover:bg-surface-soft hover:text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
                      role="menuitem"
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                onClick={(e) => {
                  // 쿼리스트링까지 보존해 로그인 후 정확히 같은 화면으로 복귀
                  // (예: /quote?vehicle=…&restore=1 — pathname 만 담으면 차량 정보가 사라져 /cars 로 튕김)
                  e.preventDefault();
                  const next = window.location.pathname + window.location.search;
                  router.push(`/login?next=${encodeURIComponent(next)}`);
                }}
                className="inline-flex min-h-11 items-center rounded-pill border border-brand/20 px-3 text-[12px] font-bold text-brand transition-all duration-state hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] md:px-4 md:text-[13px]"
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
