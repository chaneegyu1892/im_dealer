"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneCall } from "lucide-react";

const DISPLAY_PHONE = "1688-8479";
const PHONE_LINK = "tel:16888479";

export function HeaderCallButton() {
  const [open, setOpen] = useState(false);
  const callRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (callRef.current && !callRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative lg:hidden" ref={callRef}>
      <button
        type="button"
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
          <p className="text-[12px] font-bold text-text-muted">대표전화</p>
          <p className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-text-strong">
            {DISPLAY_PHONE}
          </p>
          <a
            href={PHONE_LINK}
            aria-label={`${DISPLAY_PHONE} 전화 걸기`}
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
