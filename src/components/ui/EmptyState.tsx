import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "mx-auto flex w-full flex-col items-center justify-center rounded-card bg-surface p-6 text-center",
        "border border-border-subtle",
        "min-h-[180px]",
        className
      )}
    >
      {icon && <div className="mb-3 text-text-muted">{icon}</div>}
      <h3 className="mb-2 text-label font-bold text-text-strong">{title}</h3>
      {description && (
        <p className="max-w-[35ch] text-[14px] leading-6 text-text-body">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </section>
  );
}
