"use client";

import { useState, useId, type ReactNode, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
  className,
  titleClassName,
  contentClassName,
}: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const headerId = useId();
  const panelId = useId();

  const toggle = () => setOpen((prev) => !prev);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <div className={cn("border-b border-white/10", className)}>
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-3 py-3 text-left",
          "text-[13px] font-medium text-white/80 hover:text-white transition-colors",
          titleClassName
        )}
      >
        <span>{title}</span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0"
          )}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          "grid transition-all duration-200",
          open ? "grid-rows-[1fr] opacity-100 pb-4" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("text-[12px] leading-relaxed text-white/60", contentClassName)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface AccordionProps {
  children: ReactNode;
  className?: string;
}

export function Accordion({ children, className }: AccordionProps) {
  return <div className={cn("w-full", className)}>{children}</div>;
}
