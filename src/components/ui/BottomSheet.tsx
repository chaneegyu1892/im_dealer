"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** 시트 최대 높이 (기본 85vh) */
  maxHeight?: string;
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
}: BottomSheetProps) {
  // 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Sheet */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full sm:max-w-[440px] bg-white rounded-t-[24px] sm:rounded-[24px] shadow-pop overflow-hidden"
            style={{ maxHeight }}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-pill bg-line2" />
            </div>

            {title && (
              <div className="flex items-center justify-between px-5 pt-2 pb-3">
                <h3 className="text-[18px] font-extrabold text-ink">{title}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="닫기"
                  className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-g2 transition-colors hover:bg-sec hover:text-ink"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div
              className="overflow-y-auto px-5 pb-6"
              style={{
                maxHeight: `calc(${maxHeight} - 64px)`,
                paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
              }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
