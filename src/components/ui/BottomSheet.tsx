"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 시트 최대 높이 (기본 85vh) */
  maxHeight?: string;
  /** 접근성에서 사용할 닫기 버튼 문구 */
  closeAriaLabel?: string;
}

/**
 * 토스풍 바텀시트 — 트림·기간·주행거리 등 선택을 모달 대신 아래에서 올라오는 시트로.
 * 모바일 기준. 데스크톱에서도 중앙 정렬로 동작.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeight = "85vh",
  closeAriaLabel = "닫기",
}: BottomSheetProps) {
  const sheetTitleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const focusableQuery =
    "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([disabled]):not([tabindex='-1'])";

  // 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) {
      return;
    }

    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusSheet = () => {
      const focusables = sheetRef.current?.querySelectorAll<HTMLElement>(focusableQuery);
      const focusableList = focusables ? Array.from(focusables) : [];
      const firstFocusable = focusableList[0];

      if (firstFocusable) {
        firstFocusable.focus();
        return;
      }

      sheetRef.current?.focus();
    };
    window.requestAnimationFrame(focusSheet);

    return () => {
      document.body.style.overflow = original;
      previouslyFocused.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // 키보드 인터랙션: ESC 닫기 + Tab 순환
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") {
        return;
      }

      const root = sheetRef.current;
      if (!root) return;

      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(focusableQuery)
      ).filter((element) => element.tabIndex >= 0);

      if (focusables.length === 0) {
        root.focus();
        e.preventDefault();
        return;
      }

      const active = document.activeElement;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const sheetInitial = reducedMotion ? { opacity: 0.7, y: "20px" } : { opacity: 0.7, y: "100%" };
  const sheetAnimate = { opacity: 1, y: "0%" };
  const panelTransition: Transition = reducedMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 360, damping: 34, mass: 0.6 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bottom-sheet-root"
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            key="bottom-sheet-backdrop"
            className="absolute inset-0 bg-text-strong/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            key="bottom-sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-label={title ? undefined : "바텀시트"}
            aria-labelledby={title ? sheetTitleId : undefined}
            ref={sheetRef}
            tabIndex={-1}
            className={cn(
              "relative w-full overflow-hidden rounded-t-[24px] border border-border-subtle bg-surface text-text-body sm:max-w-[440px] sm:rounded-[24px]",
              "shadow-modal sm:items-center",
              "dark:border-border-strong"
            )}
            style={{ maxHeight }}
            initial={sheetInitial}
            animate={sheetAnimate}
            exit={{ opacity: 0.3, y: "100%" }}
            transition={panelTransition}
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1.5 w-10 rounded-pill bg-border-strong" />
            </div>

            {title && (
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <h3 id={sheetTitleId} className="text-[18px] font-extrabold text-text-strong">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={closeAriaLabel}
                  className={cn(
                    "-mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full",
                    "text-text-body transition-colors hover:bg-surface-soft focus-visible:outline-none",
                    "focus-visible:ring-4 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  )}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div
              className="overflow-y-auto px-5 pb-6 pt-1"
              style={{
                maxHeight: `calc(${maxHeight} - 64px)`,
                paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
              }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
