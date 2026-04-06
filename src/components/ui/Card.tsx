import { cn } from "@/lib/utils";
import { type HTMLAttributes, forwardRef } from "react";

type CardVariant = "default" | "hover" | "recommended";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-white border border-[#F0F0F0] rounded-card shadow-card",
  hover:
    "bg-white border border-[#F0F0F0] rounded-card shadow-card " +
    "transition-all duration-200 " +
    "hover:shadow-card-hover hover:border-primary-200 hover:-translate-y-0.5 " +
    "cursor-pointer",
  recommended:
    "bg-white border-2 border-primary rounded-card shadow-card",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(variantStyles[variant], "p-4 md:p-6", className)}
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
    <div ref={ref} className={cn("mb-4", className)} {...props}>
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
    <div ref={ref} className={cn("mt-4 pt-4 border-t border-[#F0F0F0]", className)} {...props}>
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardBody, CardFooter, type CardProps, type CardVariant };
