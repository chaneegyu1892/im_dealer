import { cn } from "@/lib/utils";
import { type HTMLAttributes, type KeyboardEvent, forwardRef } from "react";

type CardVariant =
  | "default"
  | "hover"
  | "recommended"
  | "plain"
  | "selectable"
  | "elevated"
  | "finance"
  | "compact";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  selected?: boolean;
  empty?: boolean;
  pressed?: boolean;
  disabled?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-surface border border-border-subtle rounded-card shadow-card p-4 md:p-6",
  hover:
    "bg-surface border border-border-subtle rounded-card shadow-card p-4 md:p-6 " +
    "transition-all duration-200 hover:shadow-card-hover hover:border-brand hover:-translate-y-0.5 " +
    "focus-visible:shadow-card-hover cursor-pointer",
  recommended:
    "bg-surface border-2 border-brand rounded-card shadow-card p-4 md:p-6",
  plain: "bg-surface border border-transparent rounded-card shadow-card p-4 md:p-6",
  selectable:
    "bg-surface border border-line2 rounded-card shadow-card p-4 md:p-6 cursor-pointer",
  elevated:
    "bg-surface-raised border border-border-subtle rounded-card shadow-mobile-float p-4 md:p-6",
  finance:
    "bg-surface-soft border border-line2 rounded-card shadow-card p-4 md:p-6",
  compact: "bg-surface border border-border-subtle rounded-card shadow-card p-3",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      className,
      interactive = false,
      selected = false,
      pressed = false,
      empty = false,
      disabled,
      onClick,
      onKeyDown,
      children,
      ...props
    },
    ref
  ) => {
    const isInteractive = interactive || variant === "selectable";
    const isDisabled = isInteractive && disabled;
    const interactiveStyles = isInteractive
      ? "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface cursor-pointer"
      : "";
    const stateStyles = cn(
      interactiveStyles,
      selected && "border-brand bg-brand-soft shadow-card-hover",
      pressed && "scale-[0.995]",
      isDisabled && "opacity-50 pointer-events-none cursor-not-allowed",
      empty && "border-dashed border-border-subtle bg-surface text-g2"
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);

      if (event.defaultPrevented || isDisabled) {
        return;
      }

      const isActivationKey = event.key === "Enter" || event.key === " " || event.key === "Spacebar";
      if (!isActivationKey) {
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
      }

      if (onClick) {
        event.currentTarget.click();
      }
    };

    return (
      <div
        ref={ref}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive && !isDisabled ? 0 : undefined}
        aria-disabled={isDisabled ? true : undefined}
        className={cn(variantStyles[variant], "transition-colors duration-200", stateStyles, className)}
        onClick={onClick}
        onKeyDown={isInteractive ? handleKeyDown : onKeyDown}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// ── 서브 컴포넌트 ────────────────────────────────────────

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("mb-3", className)} {...props}>
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex-1", className)} {...props}>
      {children}
    </div>
  )
);
CardBody.displayName = "CardBody";

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("mt-4 pt-4 border-t border-line", className)} {...props}>
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardBody, CardFooter, type CardProps, type CardVariant };
