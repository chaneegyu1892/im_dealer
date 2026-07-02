import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactNode } from "react";

type BadgeVariant = "info" | "positive" | "warning" | "danger" | "neutral" | "brand";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  info: "bg-status-info-soft text-status-info border border-status-info",
  positive: "bg-status-positive-soft text-status-positive border border-status-positive",
  warning: "bg-status-warning-soft text-status-warning border border-status-warning",
  danger: "bg-status-danger-soft text-status-danger border border-status-danger",
  neutral: "bg-surface-soft text-text-body border border-border-subtle",
  brand: "bg-brand-soft text-brand border border-brand",
};

export function Badge({
  variant = "neutral",
  size = "md",
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12px]";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-pill font-semibold leading-none",
        "min-h-[22px]",
        sizeClass,
        VARIANT_CLASS[variant],
        className
      )}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

export { type BadgeVariant, type BadgeSize, type BadgeProps };
