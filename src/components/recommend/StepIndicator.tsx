import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1, label: "업종" },
  { id: 2, label: "목적" },
  { id: 3, label: "주행·연료" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface StepIndicatorProps {
  currentStep: StepId;
  className?: string;
}


export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="mb-3 flex items-center justify-between">
        <span className="public-quiet-label">추천 진행</span>
        <span className="text-[12px] font-semibold text-primary">{currentStep} / {STEPS.length}</span>
      </div>
      <div className="flex items-center gap-2">
      {STEPS.map((step) => {
        const isDone = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div key={step.id} className="min-w-0 flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                step.id <= currentStep ? "bg-primary" : "bg-[#DDE1EC]"
              )}
            />
            <div className="mt-2 flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                  "text-[11px] font-semibold transition-all duration-300",
                  isDone && "bg-primary text-white",
                  isActive && "bg-primary text-white",
                  !isDone && !isActive && "bg-[#E8EBF3] text-public-muted"
                )}
              >
                {isDone ? (
                  <Check size={11} strokeWidth={3} />
                ) : (
                  <span>{step.id}</span>
                )}
              </div>

              <span
                className={cn(
                  "truncate text-[11px] leading-none",
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
    </div>
  );
}

export { STEPS, type StepId };
