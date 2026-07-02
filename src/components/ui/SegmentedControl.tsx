"use client";

import { type KeyboardEvent, type ReactNode, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface SegmentedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

type SegmentedSize = "sm" | "md" | "lg";

interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: SegmentedSize;
  disabled?: boolean;
  className?: string;
  label?: ReactNode;
  name?: string;
}

const SIZE_STYLE: Record<SegmentedSize, string> = {
  sm: "min-h-[44px] px-3 py-2.5 text-[13px]",
  md: "min-h-[44px] px-4 py-2.5 text-[14px]",
  lg: "min-h-[48px] px-[18px] py-3 text-[15px]",
};

function getNextIndex(
  currentIndex: number,
  direction: "prev" | "next",
  options: SegmentedOption[]
) {
  if (options.length === 0) {
    return -1;
  }

  const step = direction === "next" ? 1 : -1;
  let cursor = currentIndex;

  for (let i = 0; i < options.length; i += 1) {
    cursor = (cursor + step + options.length) % options.length;
    if (!options[cursor]?.disabled) {
      return cursor;
    }
  }

  return currentIndex;
}

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  disabled = false,
  className,
  label,
  name,
}: SegmentedControlProps) {
  const segmentId = useId();
  const isControlled = value !== undefined;
  const firstEnabled = options.find((option) => !option.disabled);
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ?? firstEnabled?.value ?? ""
  );
  const currentValue = isControlled ? value : internalValue;

  const normalizedOptions = useMemo(
    () => options.filter((option) => Boolean(option.value)),
    [options]
  );
  const hasValue = normalizedOptions.some((option) => option.value === currentValue);
  const safeValue = hasValue ? currentValue : firstEnabled?.value ?? normalizedOptions[0]?.value ?? "";

  const commitValue = (nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onValueChange?.(nextValue);
  };

  const selectedIndex = normalizedOptions.findIndex((option) => option.value === safeValue);

  const onSegmentKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    const key = event.key;
    const isForward = key === "ArrowRight" || key === "ArrowDown";
    const isBackward = key === "ArrowLeft" || key === "ArrowUp";

    if (!isForward && !isBackward && key !== "Home" && key !== "End" && key !== " " && key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (key === "Home") {
      const firstEnabledIndex = normalizedOptions.findIndex((option) => !option.disabled);
      if (firstEnabledIndex !== -1) {
        commitValue(normalizedOptions[firstEnabledIndex]?.value ?? safeValue);
      }
      return;
    }

    if (key === "End") {
      const lastEnabledIndex =
        [...normalizedOptions].reverse().findIndex((option) => !option.disabled);
      const targetIndex =
        lastEnabledIndex === -1 ? -1 : normalizedOptions.length - 1 - lastEnabledIndex;
      if (targetIndex !== -1) {
        commitValue(normalizedOptions[targetIndex]?.value ?? safeValue);
      }
      return;
    }

    if (key === " " || key === "Enter") {
      commitValue(safeValue);
      return;
    }

    const nextIndex = isForward
      ? getNextIndex(selectedIndex, "next", normalizedOptions)
      : getNextIndex(selectedIndex, "prev", normalizedOptions);
    const next = normalizedOptions[nextIndex];
    if (next) {
      commitValue(next.value);
      const nextButton = document.getElementById(`${segmentId}-${next.value}`);
      nextButton?.focus();
    }
  };

  if (normalizedOptions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <span id={`${segmentId}-label`} className="text-label font-bold text-text-body">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={typeof label === "string" ? label : "세그먼트"}
        aria-labelledby={typeof label === "string" ? undefined : `${segmentId}-label`}
        className="relative grid w-full gap-1 rounded-[13px] bg-surface-soft p-1"
        onKeyDown={onSegmentKeyDown}
      >
        {normalizedOptions.map((option) => {
          const isActive = safeValue === option.value;
          const isDisabled = Boolean(disabled || option.disabled);
          const optionButtonId = `${segmentId}-${option.value}`;
          return (
            <button
              key={option.value}
              id={optionButtonId}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={isDisabled}
              aria-disabled={isDisabled || undefined}
              name={name}
              className={cn(
                "relative inline-flex items-center justify-center text-center font-semibold leading-snug rounded-[10px] transition-all",
                "whitespace-nowrap min-w-0",
                SIZE_STYLE[size],
                isActive &&
                  "bg-surface text-text-strong shadow-card border border-border-strong",
                !isActive &&
                  "text-text-body hover:bg-surface hover:text-text-strong border border-transparent",
                !isActive && !isDisabled && "focus-visible:border-brand focus-visible:text-text-strong",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                isDisabled && "cursor-not-allowed opacity-55"
              )}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (isDisabled) return;
                commitValue(option.value);
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { SegmentedControl as default, type SegmentedOption, type SegmentedSize };
