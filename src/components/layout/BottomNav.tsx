"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { openChannelTalk } from "@/lib/channel-talk";
import { cn } from "@/lib/utils";
import { CarFront, ClipboardCheck, Home, Menu, MessageCircle, type LucideIcon } from "lucide-react";

interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  channelTalk?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home, exact: true },
  { href: "/recommend", label: "AI 추천", icon: ClipboardCheck, exact: false },
  { href: "/cars", label: "차량 탐색", icon: CarFront, exact: false },
  { label: "상담", icon: MessageCircle, exact: false, channelTalk: true },
];

/**
 * sticky CTA 등이 하단 네비와 맞출 때 쓰는 스택 오프셋 (safe-area 제외)
 * - 펼침: 전체 메뉴바 위
 * - 축소: 중앙 FAB과 같은 바닥선(나란히)
 */
const STACK_OFFSET_EXPANDED = "104px";
const STACK_OFFSET_COLLAPSED = "10px";
const CSS_VAR_STACK_OFFSET = "--bottom-nav-stack-offset";
const CSS_VAR_NAV_COLLAPSED = "--bottom-nav-collapsed";

/** 누적 스크롤이 이 값을 넘으면 접기/펼치기 */
const SCROLL_ACCUM_THRESHOLD_PX = 24;
const SCROLL_TOP_ALWAYS_EXPAND = 48;

function setStackOffset(collapsed: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(
    CSS_VAR_STACK_OFFSET,
    collapsed ? STACK_OFFSET_COLLAPSED : STACK_OFFSET_EXPANDED,
  );
  document.documentElement.style.setProperty(CSS_VAR_NAV_COLLAPSED, collapsed ? "1" : "0");
  document.documentElement.dataset.bottomNavCollapsed = collapsed ? "true" : "false";
}

function clearStackOffset() {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty(CSS_VAR_STACK_OFFSET);
  document.documentElement.style.removeProperty(CSS_VAR_NAV_COLLAPSED);
  delete document.documentElement.dataset.bottomNavCollapsed;
}

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const prefersReducedMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const accumDy = useRef(0);
  const scrollRafPending = useRef(false);
  const scrollRafId = useRef<number | null>(null);

  const tapAnimation = prefersReducedMotion ? undefined : { scale: 0.96 };
  const springTransition: Transition | undefined = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 420, damping: 28, mass: 0.85 };
  const dockTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 380, damping: 30, mass: 0.9 };
  const fabTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 460, damping: 24, mass: 0.7 };

  const activeIconAnimation = prefersReducedMotion
    ? { opacity: activeOpacity(true) }
    : { y: -1, scale: 1.02 };
  const inactiveIconAnimation = prefersReducedMotion
    ? { opacity: activeOpacity(false) }
    : { y: 0, scale: 1 };

  // 견적·추천·후기작성 플로우는 단일 작업 화면이므로 탭바와 겹침 방지
  // /recommend/result(추천 결과)는 완료 화면이라 하단 CTA가 잘 보이도록 숨김.
  const hidden =
    pathname.startsWith("/quote") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/recommend") ||
    pathname.startsWith("/reviews/write");

  const expand = useCallback(() => {
    accumDy.current = 0;
    lastScrollY.current = typeof window !== "undefined" ? window.scrollY : 0;
    setCollapsed(false);
  }, []);

  useEffect(() => {
    if (hidden) {
      clearStackOffset();
      return;
    }
    setStackOffset(collapsed);
  }, [collapsed, hidden]);

  useEffect(() => {
    if (hidden) return;

    lastScrollY.current = window.scrollY;
    accumDy.current = 0;
    setStackOffset(false);

    const onScroll = () => {
      // boolean 가드: 동기 rAF mock에서도 콜백 후 id 재할당으로 잠기지 않음
      if (scrollRafPending.current) return;
      scrollRafPending.current = true;
      scrollRafId.current = window.requestAnimationFrame(() => {
        scrollRafPending.current = false;
        scrollRafId.current = null;

        const y = window.scrollY;
        const dy = y - lastScrollY.current;
        lastScrollY.current = y;

        if (y <= SCROLL_TOP_ALWAYS_EXPAND) {
          accumDy.current = 0;
          setCollapsed(false);
          return;
        }

        // 노이즈 무시
        if (Math.abs(dy) < 1) return;

        // 방향이 바뀌면 누적 리셋
        if ((accumDy.current > 0 && dy < 0) || (accumDy.current < 0 && dy > 0)) {
          accumDy.current = 0;
        }
        accumDy.current += dy;

        if (accumDy.current >= SCROLL_ACCUM_THRESHOLD_PX) {
          accumDy.current = 0;
          setCollapsed(true);
        } else if (accumDy.current <= -SCROLL_ACCUM_THRESHOLD_PX) {
          accumDy.current = 0;
          setCollapsed(false);
        }
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRafId.current !== null) {
        window.cancelAnimationFrame(scrollRafId.current);
        scrollRafId.current = null;
      }
      scrollRafPending.current = false;
      clearStackOffset();
    };
  }, [hidden]);

  if (hidden) {
    return null;
  }

  const isActive = (href: string | undefined, exact: boolean, channelTalk?: boolean) => {
    if (channelTalk || !href) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const activeItem =
    NAV_ITEMS.find((item) => isActive(item.href, item.exact, item.channelTalk)) ?? NAV_ITEMS[0];
  const ActiveIcon = activeItem.icon;

  return (
    <nav
      className={cn("fixed bottom-0 left-0 right-0 z-50 px-3 lg:hidden", isHome && "home-showroom-scope")}
      aria-label="하단 메뉴"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="relative pb-[max(10px,env(safe-area-inset-bottom,0px))]">
        <AnimatePresence initial={false} mode="popLayout">
          {!collapsed ? (
            <motion.div
              key="bottom-nav-expanded"
              className="relative mx-auto grid h-[64px] max-w-[480px] grid-cols-4 overflow-hidden rounded-card-lg border border-border-subtle bg-surface-glass px-1 shadow-mobile-float backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150"
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 28, scale: 0.94, filter: "blur(4px)" }
              }
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 36, scale: 0.9, filter: "blur(6px)" }
              }
              transition={dockTransition}
            >
              {NAV_ITEMS.map(({ href, label, icon: Icon, exact, channelTalk }) => {
                const active = isActive(href, exact, channelTalk);

                const inner = (
                  <motion.span
                    className="relative flex min-h-11 w-full cursor-pointer select-none flex-col items-center justify-center gap-0.5 rounded-[14px] px-1 py-1"
                    whileTap={tapAnimation}
                    transition={springTransition}
                  >
                    <motion.span
                      className={cn(
                        "relative z-10 flex h-8 min-w-8 items-center justify-center rounded-full transition-colors duration-state",
                        active ? "bg-brand-soft text-brand" : "bg-transparent text-text-muted",
                      )}
                      animate={active ? activeIconAnimation : inactiveIconAnimation}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 400, damping: 25 }
                      }
                    >
                      <Icon
                        size={active ? 18 : 17}
                        strokeWidth={active ? 2.35 : 1.85}
                        className="transition-colors duration-state"
                      />
                    </motion.span>

                    <motion.span
                      className={cn(
                        "relative z-10 whitespace-nowrap text-[10px] font-bold leading-none tracking-normal transition-colors duration-state",
                        active ? "text-text-strong" : "text-text-muted",
                      )}
                      animate={{ opacity: activeOpacity(active) }}
                    >
                      {label}
                    </motion.span>
                  </motion.span>
                );

                const wrapperClass = cn(
                  "flex min-h-11 items-center justify-center rounded-[15px] px-0.5 transition-colors duration-state",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  active ? "bg-surface" : "hover:bg-surface-soft active:bg-surface-soft",
                );

                if (channelTalk) {
                  return (
                    <button
                      key="channeltalk"
                      type="button"
                      className={wrapperClass}
                      aria-label={label}
                      onClick={openChannelTalk}
                    >
                      {inner}
                    </button>
                  );
                }

                if (!href) return null;

                return (
                  <Link
                    key={href}
                    href={href}
                    className={wrapperClass}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                  >
                    {inner}
                  </Link>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="bottom-nav-fab"
              className="flex justify-center"
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, scale: 0.45, y: 18 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.55, y: 10 }
              }
              transition={fabTransition}
            >
              <motion.button
                type="button"
                aria-label="메뉴 열기"
                aria-expanded={false}
                onClick={expand}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
                className={cn(
                  "relative flex h-12 w-12 items-center justify-center rounded-full",
                  "border border-border-subtle bg-surface-glass text-text-strong shadow-mobile-float",
                  "backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                )}
              >
                <span className="absolute inset-0 rounded-full bg-brand-soft/40" aria-hidden />
                <ActiveIcon size={18} strokeWidth={2.2} className="relative z-10 text-brand" />
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white shadow-sm"
                  aria-hidden
                >
                  <Menu size={10} strokeWidth={2.6} />
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}

function activeOpacity(active: boolean) {
  return active ? 1 : 0.78;
}
