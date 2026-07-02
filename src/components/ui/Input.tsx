import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from "react";

type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  size?: InputSize;
}

const SIZE_STYLE: Record<InputSize, string> = {
  sm: "min-h-[44px] px-3 py-2 text-[14px]",
  md: "min-h-[44px] px-4 py-3 text-[15px]",
  lg: "min-h-[48px] px-4 py-3.5 text-[16px]",
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, size = "md", className, id, disabled, required, ...props }, ref) => {
    const fallbackId = useId();
    const inputId = id ?? `input-${fallbackId}`;
    const helpId = `${inputId}-help`;
    const errorId = `${inputId}-error`;
    const hasError = Boolean(error);
    const hasDescription = Boolean(helperText) || hasError;
    const describedBy = hasDescription
      ? `${error ? errorId : ""} ${helperText ? helpId : ""}`.trim()
      : undefined;

    return (
      <label htmlFor={inputId} className="block">
        <div className="space-y-1.5">
          {label && (
            <span className="inline-flex w-full text-label font-bold leading-snug text-text-body">
              {label}
              {required ? <span className="text-status-danger" aria-hidden="true"> *</span> : null}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            disabled={disabled}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            className={cn(
              "w-full rounded-btn border border-border-subtle bg-surface text-text-strong outline-none",
              "placeholder:text-text-muted transition-[border-color,box-shadow] duration-200",
              "focus-visible:ring-4 focus-visible:ring-focus/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:border-focus-ring",
              "motion-safe:transition-all",
              SIZE_STYLE[size],
              disabled &&
                "cursor-not-allowed opacity-60 border-border-strong bg-surface-soft text-text-muted",
              hasError &&
                "border-status-danger text-status-danger focus-visible:border-status-danger focus-visible:ring-status-danger/20",
              className
            )}
            {...props}
          />
        </div>

        {hasDescription && (
          <p
            id={hasError ? errorId : helpId}
            className={cn(
              "mt-1.5 min-h-[20px] text-caption leading-snug",
              hasError ? "text-status-danger" : "text-text-muted"
            )}
          >
            {error || helperText}
          </p>
        )}
      </label>
    );
  }
);

Input.displayName = "Input";

export { Input, type InputProps, type InputSize };
