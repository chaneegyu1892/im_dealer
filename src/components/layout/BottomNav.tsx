"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";
import { CarFront, ClipboardCheck, Home, MessageCircle, type LucideIcon } from "lucide-react";

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
  { href: "/cars", label: "차량탐색", icon: CarFront, exact: false },
  { label: "상담", icon: MessageCircle, exact: false, channelTalk: true },
];

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const isHome = pathname === "/";
  const prefersReducedMotion = useReducedMotion();
  const tapAnimation = prefersReducedMotion ? undefined : { scale: 0.96 };
  const springTransition: Transition | undefined = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 500, damping: 30 };
  const activeIconAnimation = prefersReducedMotion
    ? { opacity: activeOpacity(true) }
    : { y: -1, scale: 1.02 };
  const inactiveIconAnimation = prefersReducedMotion
    ? { opacity: activeOpacity(false) }
    : { y: 0, scale: 1 };

  // 견적·추천·후기작성 플로우는 단일 작업 화면이므로 탭바와 겹침 방지
  if (
    pathname.startsWith("/quote") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/verify") ||
    pathname === "/recommend" ||
    pathname.startsWith("/reviews/write")
  ) {
    return null;
  }

  const isActive = (href: string | undefined, exact: boolean, channelTalk?: boolean) => {
    if (channelTalk || !href) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav className={cn("fixed bottom-0 left-0 right-0 z-50 px-3 lg:hidden", isHome && "home-showroom-scope")} aria-label="하단 메뉴">
      <div
        className="pb-[max(10px,env(safe-area-inset-bottom,0px))]"
      >
        <div className="relative mx-auto grid h-[64px] max-w-[480px] grid-cols-4 overflow-hidden rounded-card-lg border border-border-subtle bg-surface-glass px-1 shadow-mobile-float backdrop-blur-xl supports-[backdrop-filter]:backdrop-saturate-150">
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
                    active ? "bg-brand-soft text-brand" : "bg-transparent text-text-muted"
                  )}
                  animate={active ? activeIconAnimation : inactiveIconAnimation}
                  transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 25 }}
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
                    active ? "text-text-strong" : "text-text-muted"
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
              active ? "bg-surface" : "hover:bg-surface-soft active:bg-surface-soft"
            );

            if (channelTalk) {
              return (
                <button
                  key="channeltalk"
                  type="button"
                  className={wrapperClass}
                  aria-label={label}
                  onClick={() => window.ChannelIO?.("openChat")}
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
        </div>
      </div>
    </nav>
  );
}

function activeOpacity(active: boolean) {
  return active ? 1 : 0.78;
}
