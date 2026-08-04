"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, X } from "lucide-react";
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL_HREF,
} from "@/lib/contact";

export function HeaderCallButton() {
  const [open, setOpen] = useState(false);
  const callRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 키보드·닫기 버튼으로 닫을 때는 트리거로 포커스를 되돌려 탐색 위치를 잃지 않게 한다.
  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (callRef.current && !callRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndRestoreFocus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeAndRestoreFocus]);

  return (
    // 패널은 이 래퍼가 아니라 Header 의 헤더 바(relative 컨테이너)를 기준으로 정렬된다.
    // 버튼 기준으로 잡으면 좁은 화면에서 왼쪽으로 넘쳐 별도 보정이 필요하기 때문이다.
    <div className="lg:hidden" ref={callRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-pill text-brand transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        aria-label="대표전화 보기"
        aria-controls="header-call-panel"
        aria-expanded={open}
      >
        <Phone size={19} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          id="header-call-panel"
          className="absolute right-0 top-full z-50 mt-2 w-60 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-mobile-float"
        >
          <button
            type="button"
            onClick={closeAndRestoreFocus}
            aria-label="대표전화 닫기"
            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-soft hover:text-text-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40"
          >
            <X size={16} strokeWidth={2.4} />
          </button>

          <p className="text-[12px] font-bold text-text-muted">대표전화</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-text-strong">
            {SUPPORT_PHONE_DISPLAY}
          </p>
          <a
            href={SUPPORT_PHONE_TEL_HREF}
            aria-label={`${SUPPORT_PHONE_DISPLAY} 전화 걸기`}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 text-[14px] font-extrabold text-white transition-all duration-state hover:bg-brand-pressed focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.98]"
          >
            <PhoneCall size={17} strokeWidth={2.4} />
            대표전화 연결
          </a>
        </div>
      )}
    </div>
  );
}
