"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import {
  LogIn,
  LogOut,
  ReceiptText,
  Settings,
  Ticket,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface MyMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MY_MENU_ITEMS: MyMenuItem[] = [
  { href: "/mypage", label: "내 견적보기", icon: ReceiptText },
  { href: "/mypage/referral", label: "추천인 페이지", icon: UserPlus },
  { href: "/mypage/coupons", label: "쿠폰함", icon: Ticket },
  { href: "/mypage", label: "내 정보", icon: Settings },
];

/**
 * 모바일 바닥 고정 위치.
 * BottomNav 스택 오프셋(펼침 88px / 축소 16px) 위에 얹되,
 * 차량 상세의 sticky 견적 CTA 줄(h-14 = 56px)까지 피하도록 12px 여유를 더한다.
 * → 56 + 12 = 68px. 데스크톱은 lg:bottom-6(24px)로 되돌린다.
 */
const MOBILE_BOTTOM_CLASS =
  "bottom-[calc(var(--bottom-nav-stack-offset,88px)+env(safe-area-inset-bottom,0px)+68px)]";

/**
 * 단일 작업 화면에서는 숨긴다(BottomNav 와 동일 기준).
 * 홈(`/`)은 히어로 CTA 가 주도하므로 별도로 제외한다.
 */
const HIDDEN_PREFIXES = ["/quote", "/login", "/verify", "/recommend", "/reviews/write"] as const;

const MENU_ITEM_BASE_CLASS =
  "flex min-h-11 w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] transition-colors duration-state focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40";

export function MyMenuFAB() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthResolved(true);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 경로가 바뀌면(메뉴로 이동 포함) 열린 메뉴를 닫는다.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 바깥 클릭 / ESC 로 닫기 — Header 드롭다운과 동일 패턴
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
    router.refresh();
  }, [router]);

  const hidden = pathname === "/" || HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // 인증 확인 전에는 렌더하지 않는다 — "로그인 → My" 라벨이 튀는 것을 막는다.
  if (hidden || !authResolved) {
    return null;
  }

  const springTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 420, damping: 28, mass: 0.85 };

  const wrapperClass = cn(
    "fixed right-4 z-[60] lg:bottom-6 lg:right-6",
    MOBILE_BOTTOM_CLASS,
  );

  const fabClass = cn(
    "flex min-h-11 items-center gap-2 rounded-pill bg-brand px-4 py-3 text-white shadow-float",
    "transition-colors duration-state hover:bg-brand-pressed",
    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    "lg:px-5 lg:py-3.5",
  );

  if (!user) {
    return (
      <div className={wrapperClass}>
        <Link href="/login" aria-label="로그인" className={fabClass}>
          <LogIn size={18} strokeWidth={2.2} />
          <span className="text-[14px] font-semibold">로그인</span>
        </Link>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={wrapperClass}>
      <AnimatePresence>
        {open && (
          <motion.div
            key="my-menu-panel"
            role="menu"
            aria-label="My 메뉴 목록"
            className="absolute bottom-full right-0 mb-2 w-52 overflow-hidden rounded-card border border-border-subtle bg-surface-raised py-1 shadow-float"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
            transition={springTransition}
          >
            {MY_MENU_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  MENU_ITEM_BASE_CLASS,
                  "font-bold text-text-strong hover:bg-surface-soft",
                )}
              >
                <Icon size={16} strokeWidth={2.1} className="shrink-0 text-brand" />
                {label}
              </Link>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={cn(
                MENU_ITEM_BASE_CLASS,
                "border-t border-border-subtle font-semibold text-text-body hover:bg-surface-soft hover:text-text-strong",
              )}
            >
              <LogOut size={16} strokeWidth={2.1} className="shrink-0 text-text-muted" />
              로그아웃
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="My 메뉴"
        aria-expanded={open}
        aria-haspopup="menu"
        whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
        transition={springTransition}
        className={fabClass}
      >
        <UserRound size={18} strokeWidth={2.2} />
        <span className="text-[14px] font-semibold">My</span>
      </motion.button>
    </div>
  );
}
