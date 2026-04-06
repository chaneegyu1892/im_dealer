"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Home, Sparkles, Car, MessageCircle, type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact: boolean;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",               label: "홈",      icon: Home,          exact: true  },
  { href: "/recommend",      label: "AI 추천",  icon: Sparkles,      exact: false },
  { href: "/cars",           label: "차량탐색", icon: Car,           exact: false },
  { href: "https://channeltalk.io", label: "상담", icon: MessageCircle, exact: false, external: true },
];

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string, exact: boolean, external?: boolean) => {
    if (external) return false;
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Frosted glass bar */}
      <div
        className="relative mx-3 mb-3 rounded-[20px] overflow-hidden"
        style={{
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow:
            "0 -1px 0 rgba(0,0,0,0.04), 0 8px 32px rgba(0, 6, 102, 0.12), 0 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid rgba(255,255,255,0.6)",
        }}
      >
        <div className="flex items-center justify-around h-[62px] px-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact, external }) => {
            const active = isActive(href, exact, external);

            const inner = (
              <motion.span
                className="relative flex flex-col items-center justify-center gap-[3px] w-full py-1 cursor-pointer select-none"
                whileTap={{ scale: 0.91 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {/* Sliding active pill */}
                <AnimatePresence>
                  {active && (
                    <motion.span
                      layoutId="bottomNavPill"
                      className="absolute inset-0 rounded-[14px]"
                      style={{ background: "#000666" }}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon */}
                <motion.span
                  className="relative z-10 flex items-center justify-center"
                  animate={active ? { y: -1 } : { y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Icon
                    size={21}
                    strokeWidth={active ? 2.2 : 1.7}
                    className={cn(
                      "transition-colors duration-200",
                      active ? "text-white" : "text-[#A0A0A0]"
                    )}
                  />
                </motion.span>

                {/* Label */}
                <motion.span
                  className={cn(
                    "relative z-10 text-[9.5px] font-semibold leading-none tracking-wide transition-colors duration-200",
                    active ? "text-white" : "text-[#A0A0A0]"
                  )}
                  animate={active ? { opacity: 1 } : { opacity: 0.75 }}
                >
                  {label}
                </motion.span>
              </motion.span>
            );

            const wrapperClass = "flex-1 flex justify-center px-1";

            if (external) {
              return (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={wrapperClass}
                  aria-label={label}
                >
                  {inner}
                </a>
              );
            }

            return (
              <Link
                key={href}
                href={href}
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
