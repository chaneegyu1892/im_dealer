import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "업종" },
  { id: 2, label: "원하는 차" },
  { id: 3, label: "주행·연료" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface StepIndicatorProps {
  currentStep: StepId;
  className?: string;
}

export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  const pct = (currentStep / STEPS.length) * 100;

  return (
    <div className={cn("t-progress", className)}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export { STEPS, type StepId };
