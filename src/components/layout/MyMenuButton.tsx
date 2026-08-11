"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gift,
  LogOut,
  Shield,
  Ticket,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles";
import { cn } from "@/lib/utils";

const MENU_ITEMS = [
  { href: "/mypage/quotes", label: "내 견적보기", icon: Ticket },
  { href: "/mypage/referral", label: "추천인 페이지", icon: Users },
  { href: "/mypage/coupons", label: "쿠폰함", icon: Gift },
  { href: "/mypage/profile", label: "내 정보", icon: UserRound },
] as const;

/**
 * 헤더 우측 My 버튼 + 아이콘 메뉴.
 * 비로그인 시 로그인으로 이동, 로그인 시 드롭다운 메뉴를 연다.
 */
export function MyMenuButton() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) setDbRole(null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setDbRole(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled) setDbRole(payload?.data?.role ?? null);
      })
      .catch(() => {
        if (!cancelled) setDbRole(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const isAdminUser =
    !!dbRole && (ADMIN_ROLES as readonly string[]).includes(dbRole as AdminRole);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setDbRole(null);
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  function handleTriggerClick() {
    if (!user) {
      const next = window.location.pathname + window.location.search;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setOpen((current) => !current);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-label={user ? (open ? "My 메뉴 닫기" : "My 메뉴 열기") : "로그인"}
        aria-expanded={user ? open : undefined}
        aria-haspopup={user ? "menu" : undefined}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-brand px-3.5 py-2 text-white shadow-sm transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98] sm:gap-2 sm:px-4",
        )}
      >
        {open && user ? (
          <X size={17} strokeWidth={2.2} />
        ) : (
          <UserRound size={17} strokeWidth={2.2} />
        )}
        <span className="text-[13px] font-semibold sm:text-[14px]">
          {user ? "My" : "로그인"}
        </span>
      </button>

      {open && user && (
        <div
          role="menu"
          aria-label="My 메뉴"
          className="absolute right-0 top-full z-[60] mt-2 w-56 overflow-hidden rounded-card border border-border-subtle bg-surface-raised py-1 shadow-mobile-float"
        >
          {MENU_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-text-strong transition-colors hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
            >
              <Icon size={16} strokeWidth={2.1} className="text-brand" />
              {label}
            </Link>
          ))}
          {isAdminUser && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2.5 px-4 py-2.5 text-[13px] font-bold text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
            >
              <Shield size={16} strokeWidth={2.1} className="text-brand" />
              관리자 콘솔
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleLogout()}
            className="flex min-h-11 w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-text-body transition-colors hover:bg-surface-soft hover:text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
          >
            <LogOut size={16} strokeWidth={2.1} className="text-text-muted" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
