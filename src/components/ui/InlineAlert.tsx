import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type InlineAlertVariant = "info" | "positive" | "warning" | "danger";

interface InlineAlertProps {
  variant?: InlineAlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const VARIANT_CLASS: Record<
  InlineAlertVariant,
  { base: string; iconWrap: string; emphasis: string }
> = {
  info: {
    base: "bg-status-info-soft text-status-info border-status-info",
    iconWrap: "text-status-info",
    emphasis: "text-status-info",
  },
  positive: {
    base: "bg-status-positive-soft text-status-positive border-status-positive",
    iconWrap: "text-status-positive",
    emphasis: "text-status-positive",
  },
  warning: {
    base: "bg-status-warning-soft text-status-warning border-status-warning",
    iconWrap: "text-status-warning",
    emphasis: "text-status-warning",
  },
  danger: {
    base: "bg-status-danger-soft text-status-danger border-status-danger",
    iconWrap: "text-status-danger",
    emphasis: "text-status-danger",
  },
};

export function InlineAlert({
  variant = "info",
  title,
  children,
  className,
}: InlineAlertProps) {
  const variantClasses = VARIANT_CLASS[variant];
  const role = variant === "danger" || variant === "warning" ? "alert" : "status";

  return (
    <div
      role={role}
      aria-live={role === "alert" ? "assertive" : "polite"}
      className={cn(
        "rounded-[12px] border px-4 py-3 text-[14px] leading-relaxed",
        "flex items-start gap-2 border-l-4",
        variantClasses.base,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-5 w-5 shrink-0 rounded-full border bg-surface",
          "mt-0.5 text-[11px] items-center justify-center",
          "font-extrabold",
          variantClasses.iconWrap
        )}
      >
        {variant === "danger" ? "!" : "i"}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className={cn("font-bold", variantClasses.emphasis)}>{title}</p>}
        {children && <p className="text-text-body">{children}</p>}
      </div>
    </div>
  );
}

export { type InlineAlertVariant, type InlineAlertProps };
