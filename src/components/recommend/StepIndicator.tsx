import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "업종" },
  { id: 2, label: "목적" },
  { id: 3, label: "예산" },
  { id: 4, label: "성향" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface StepIndicatorProps {
  currentStep: StepId;
  className?: string;
}


export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {STEPS.map((step, idx) => {
        const isDone = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div key={step.id} className="flex items-center">
            {/* 연결선 (첫 번째 제외) */}
            {idx > 0 && (
              <div
                className={cn(
                  "h-[2px] w-16 flex-shrink-0 rounded-sm transition-colors duration-300",
                  isDone ? "bg-primary" : "bg-neutral-800"
                )}
              />
            )}

            {/* 스텝 원 + 라벨 */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                  "transition-all duration-300 text-sm font-medium",
                  isDone && "bg-primary text-white",
                  isActive && "bg-primary text-white",
                  !isDone && !isActive && "bg-neutral-800 text-ink-caption"
                )}
                style={
                  isActive
                    ? { boxShadow: "0 0 0 4px rgba(0,6,102,0.15)" }
                    : undefined
                }
              >
                {isDone ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>

              <span
                className={cn(
                  "text-[11px] leading-none",
                  isActive ? "text-primary font-medium" : "text-ink-label"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { STEPS, type StepId };
