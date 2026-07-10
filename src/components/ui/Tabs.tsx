"use client";

import { type KeyboardEvent, type ReactNode, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface TabPanel {
  value: string;
  children: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  panels?: TabPanel[];
  className?: string;
  listClassName?: string;
  panelClassName?: string;
  children?: (activeValue: string) => ReactNode;
  "aria-label"?: string;
}

const findNextEnabledIndex = (options: TabItem[], start: number, delta: 1 | -1) => {
  if (options.length === 0) return -1;

  const length = options.length;
  let cursor = start;

  for (let i = 0; i < length; i += 1) {
    cursor = (cursor + delta + length) % length;
    if (!options[cursor]?.disabled) {
      return cursor;
    }
  }

  return start;
};

export function Tabs({
  tabs,
  value,
  defaultValue,
  onChange,
  panels,
  className,
  listClassName,
  panelClassName,
  children,
  "aria-label": ariaLabel,
}: TabsProps) {
  const tabsId = useId();
  const isControlled = value !== undefined;
  const firstEnabled = tabs.find((tab) => !tab.disabled)?.value;
  const [uncontrolledValue, setUncontrolledValue] = useState<string>(
    defaultValue ?? firstEnabled ?? tabs[0]?.value ?? ""
  );

  const normalizedTabs = useMemo(
    () => tabs.filter((tab) => Boolean(tab.value)),
    [tabs]
  );
  const existsCurrent = normalizedTabs.some((tab) => tab.value === (isControlled ? value : uncontrolledValue));
  const activeValue = existsCurrent
    ? (isControlled ? value : uncontrolledValue)
    : firstEnabled ?? normalizedTabs[0]?.value ?? "";

  const commitValue = (nextValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    onChange?.(nextValue);
  };

  const activeIndex = normalizedTabs.findIndex((tab) => tab.value === activeValue);
  const panelByValue = useMemo(() => {
    const map = new Map<string, ReactNode>();
    if (!panels) {
      return map;
    }

    for (const panel of panels) {
      map.set(panel.value, panel.children);
    }
    return map;
  }, [panels]);

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isHorizontal = true;
    if (!isHorizontal) {
      return;
    }

    const key = event.key;
    const isForward = key === "ArrowRight";
    const isBackward = key === "ArrowLeft";
    if (!isForward && !isBackward && key !== "Home" && key !== "End") {
      return;
    }

    event.preventDefault();
    if (key === "Home") {
      const first = normalizedTabs.findIndex((tab) => !tab.disabled);
      if (first !== -1) {
        const target = normalizedTabs[first];
        if (target) {
          commitValue(target.value);
        }
      }
      return;
    }

    if (key === "End") {
      const lastEnabled = [...normalizedTabs].reverse().findIndex((tab) => !tab.disabled);
      const lastIndex = lastEnabled === -1 ? -1 : normalizedTabs.length - 1 - lastEnabled;
      if (lastIndex !== -1) {
        const target = normalizedTabs[lastIndex];
        if (target) {
          commitValue(target.value);
        }
      }
      return;
    }

    const nextIndex = isForward
      ? findNextEnabledIndex(normalizedTabs, activeIndex, 1)
      : findNextEnabledIndex(normalizedTabs, activeIndex, -1);
    const next = normalizedTabs[nextIndex];
    if (next) {
      commitValue(next.value);
      const target = document.getElementById(`${tabsId}-${next.value}`);
      target?.focus();
    }
  };

  if (normalizedTabs.length === 0) {
    return null;
  }

  const activeTabId = `${tabsId}-${activeValue}`;
  const activePanelId = `panel-${tabsId}-${activeValue}`;
  const activePanelContent = panels
    ? panels.find((panel) => panel.value === activeValue)?.children
    : typeof children === "function"
      ? children(activeValue)
      : children;

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn("relative flex gap-2 rounded-[12px] bg-surface-soft p-1", listClassName)}
        onKeyDown={onListKeyDown}
      >
        {normalizedTabs.map((tab) => {
          const isActive = activeValue === tab.value;
          const disabled = tab.disabled ?? false;
          return (
            <button
              key={tab.value}
              id={`${tabsId}-${tab.value}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tabsId}-${tab.value}`}
              disabled={disabled}
              className={cn(
                "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[10px]",
                "px-4 text-[14px] font-semibold leading-tight whitespace-nowrap transition-all",
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                isActive && "bg-surface text-text-strong shadow-card border border-border-strong",
                !isActive && "bg-transparent text-text-body hover:bg-surface hover:text-text-strong",
                disabled && "cursor-not-allowed opacity-55"
              )}
              tabIndex={isActive ? 0 : -1}
              onClick={() => {
                if (disabled) return;
                commitValue(tab.value);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {panels ? (
        normalizedTabs.map((tab) => {
          const isActivePanel = activeValue === tab.value;
          const panelId = `panel-${tabsId}-${tab.value}`;
          return (
            <div
              key={panelId}
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${tabsId}-${tab.value}`}
              hidden={!isActivePanel}
              className={cn("w-full", panelClassName, !isActivePanel && "hidden")}
            >
              {panelByValue.get(tab.value)}
            </div>
          );
        })
      ) : (
        <div
          id={activePanelId}
          role="tabpanel"
          aria-labelledby={activeTabId}
          className={cn("w-full", panelClassName)}
        >
          {activePanelContent}
        </div>
      )}
    </div>
  );
}

export { type TabItem, type TabPanel, type TabsProps };
