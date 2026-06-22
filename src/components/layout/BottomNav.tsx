"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Home, WandSparkles, CarFront, MessageCircle, type LucideIcon } from "lucide-react";

interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  channelTalk?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",          label: "홈",      icon: Home,          exact: true  },
  { href: "/recommend", label: "AI 추천",  icon: WandSparkles,  exact: false },
  { href: "/cars",      label: "차량탐색", icon: CarFront,      exact: false },
  {                     label: "상담",    icon: MessageCircle, exact: false, channelTalk: true },
];

export function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/quote")) {
    return null;
  }

  const isActive = (href: string | undefined, exact: boolean, channelTalk?: boolean) => {
    if (channelTalk || !href) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="relative mx-4 mb-2.5 overflow-hidden rounded-[20px] border border-public-border"
        style={{
          background: "rgba(255, 255, 255, 0.96)",
          backdropFilter: "blur(16px) saturate(145%)",
          WebkitBackdropFilter: "blur(16px) saturate(145%)",
          boxShadow: "0 10px 26px rgba(18, 24, 40, 0.10), 0 1px 3px rgba(18, 24, 40, 0.04)",
        }}
      >
        <div className="flex h-[58px] items-center justify-around px-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact, channelTalk }) => {
            const active = isActive(href, exact, channelTalk);

            const inner = (
              <motion.span
                className="relative flex w-full cursor-pointer select-none flex-col items-center justify-center gap-[2px] py-1"
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {/* Icon */}
                <motion.span
                  className={cn(
                    "relative z-10 flex h-7 min-w-7 items-center justify-center rounded-full transition-colors duration-200",
                    active ? "bg-primary/[0.08]" : "bg-transparent"
                  )}
                  animate={active ? { y: -1, scale: 1.02 } : { y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Icon
                    size={active ? 18 : 17}
                    strokeWidth={active ? 2.35 : 1.85}
                    className={cn(
                      "transition-colors duration-200",
                      active ? "text-primary" : "text-[#7B8299]"
                    )}
                  />
                </motion.span>

                {/* Label */}
                <motion.span
                  className={cn(
                    "relative z-10 text-[9px] font-semibold leading-none tracking-normal transition-colors duration-200",
                    active ? "text-primary" : "text-[#7B8299]"
                  )}
                  animate={active ? { opacity: 1 } : { opacity: 0.78 }}
                >
                  {label}
                </motion.span>
              </motion.span>
            );

            const wrapperClass = "flex-1 flex justify-center px-0.5";

            if (channelTalk) {
              return (
                <button
                  key="channeltalk"
                  type="button"
                  className={wrapperClass}
                  aria-label={label}
                  onClick={() => window.ChannelIO?.('openChat')}
                >
                  {inner}
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href!}
                className={wrapperClass}
                aria-label={label}
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
