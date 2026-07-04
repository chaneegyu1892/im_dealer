"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/BottomSheet";

// ─── 타입 ────────────────────────────────────────────────
export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** 행 우측에 작게 표시할 보조 텍스트 (예: 가격, 개수) */
  hint?: string;
  /** 행 좌측에 표시할 커스텀 노드 (예: 색상 원) */
  leading?: ReactNode;
}

interface SelectSheetProps<T extends string = string> {
  id: string;
  label: string;
  placeholder: string;
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  /** 트리거 좌측에 표시할 노드 (예: 색상 미리보기 원) */
  triggerLeading?: (value: T | null) => ReactNode;
  /** 시트 제목 (기본값: label) */
  sheetTitle?: string;
}

// ════════════════════════════════════════════════════════════
// 자체 드롭다운 — 바텀시트 기반 (Pretendard 폰트 유지)
// ════════════════════════════════════════════════════════════
export function SelectSheet<T extends string = string>({
  id,
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  triggerLeading,
  sheetTitle,
}: SelectSheetProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  const handleSelect = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-text-muted">{label}</p>

      <button
        type="button"
        id={id}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "mt-2 flex h-[54px] w-full items-center gap-3 rounded-[14px] px-4 text-left transition-all",
          disabled
            ? "cursor-not-allowed bg-[#F2F4F6] text-text-muted"
            : "bg-[#F8FAFC] text-text-strong hover:bg-[#F2F4F6] active:scale-[0.995]"
        )}
      >
        {triggerLeading && (
          <span className="shrink-0">{triggerLeading(value)}</span>
        )}
        <span className={cn("min-w-0 flex-1 truncate text-[15px] font-bold", !selected && "font-medium text-text-muted")}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.hint && (
          <span className="num shrink-0 text-[12.5px] font-bold text-text-body tabular-nums">
            {selected.hint}
          </span>
        )}
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 transition-transform duration-200",
            open && "rotate-180",
            disabled ? "text-text-muted" : "text-text-body"
          )}
        />
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label}
        maxHeight="70vh"
      >
        <div className="divide-y divide-[#E5E8EB]">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className="flex min-h-[58px] w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F8FAFC] active:bg-[#F2F4F6]"
              >
                {opt.leading && <span className="shrink-0">{opt.leading}</span>}
                <span className="min-w-0 flex-1">
                  <span className={cn(
                    "block truncate text-[15.5px] font-bold",
                    isSelected ? "text-brand" : "text-text-strong"
                  )}>
                    {opt.label}
                  </span>
                  {opt.hint && (
                    <span className="num mt-0.5 block text-[12.5px] text-text-body tabular-nums">
                      {opt.hint}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all",
                    isSelected ? "bg-brand" : "bg-transparent"
                  )}
                >
                  {isSelected && <Check size={14} strokeWidth={2.8} className="text-white" />}
                </span>
              </button>
            );
          })}
          {options.length === 0 && (
            <div className="px-5 py-8 text-center text-[14px] text-text-muted">
              선택할 수 있는 항목이 없어요.
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
