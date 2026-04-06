import { cn } from "@/lib/utils";
import {
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
  forwardRef,
  Children,
  cloneElement,
  isValidElement,
} from "react";

type ButtonVariant = "primary" | "secondary" | "inverted" | "outlined";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** 내부 자식 요소(Link 등)에 버튼 스타일을 위임 */
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:opacity-90 active:opacity-80",
  secondary:
    "bg-neutral text-primary border border-neutral-800 hover:bg-neutral-800",
  inverted:
    "bg-navy-dark text-white hover:opacity-90 active:opacity-80",
  outlined:
    "bg-transparent text-neutral-0 border border-neutral-0 hover:bg-neutral-800",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      asChild = false,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      "inline-flex items-center justify-center rounded-btn font-medium",
      "transition-all duration-200",
      "disabled:opacity-40 disabled:cursor-not-allowed",
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && "w-full",
      className
    );

    // asChild: 첫 번째 자식(Link 등)에 스타일을 주입
    if (asChild && isValidElement(children)) {
      return cloneElement(
        children as React.ReactElement<AnchorHTMLAttributes<HTMLAnchorElement>>,
        { className: cn(classes, (children.props as { className?: string }).className) }
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={classes}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
