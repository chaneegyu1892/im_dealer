import { cn } from "@/lib/utils";
import {
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "inverted"
  | "outlined"
  | "ghost"
  | "danger"
  | "icon";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** 내부 자식 요소(Link 등)에 버튼 스타일을 위임 */
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark active:bg-brand-dark",
  secondary: "bg-surface-soft text-text-body border border-line hover:bg-surface",
  inverted: "bg-navy-dark text-white hover:opacity-90 active:opacity-80",
  outlined: "bg-transparent text-ink border border-line2 hover:bg-surface-soft",
  ghost: "bg-surface text-ink border border-transparent hover:bg-surface-soft",
  danger: "bg-status-danger text-white hover:bg-status-danger/90 active:bg-status-danger/90",
  icon: "bg-surface text-text-body border border-line2 hover:bg-surface-soft",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2.5 text-[14px]",
  md: "px-6 py-3.5 text-[15px]",
  lg: "px-7 py-4 text-[16px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      asChild = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const isIconVariant = variant === "icon";

    const classes = cn(
      "relative inline-flex items-center justify-center gap-2 rounded-btn font-bold",
      "min-h-[44px] whitespace-nowrap transition-all duration-200 active:scale-[0.98]",
      "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      isIconVariant && "h-11 w-11 shrink-0 rounded-[999px] p-0",
      isDisabled && "pointer-events-none cursor-not-allowed opacity-45",
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && "w-full",
      className
    );

    const spinner = loading ? (
      <span
        aria-hidden="true"
        className={cn("h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", isIconVariant && "h-5 w-5")}
      />
    ) : null;

    const renderChildren = (label: ReactNode) => (
      <>
        {loading && (
          <span className="absolute inset-0 inline-flex items-center justify-center pointer-events-none">
            {spinner}
          </span>
        )}
        <span className={cn("inline-flex items-center gap-2 justify-center", loading && "invisible")}>
          {label}
        </span>
        <span className="sr-only">{loading ? "로딩 중" : null}</span>
      </>
    );

    if (asChild && isValidElement(children)) {
      const childProps = children.props as { className?: string; children?: ReactNode; tabIndex?: number };
      return cloneElement(
        children as ReactElement<AnchorHTMLAttributes<HTMLAnchorElement>>,
        {
          className: cn(classes, childProps.className),
          "aria-disabled": isDisabled || undefined,
          tabIndex: isDisabled ? -1 : childProps.tabIndex,
          children: renderChildren(childProps.children),
        }
      );
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={classes}
        {...props}
      >
        {renderChildren(children)}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
