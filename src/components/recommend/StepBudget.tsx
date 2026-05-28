import { BUDGET_RANGE_OPTIONS } from "@/constants/recommend-options";
import type { PaymentStyle } from "@/types/recommendation";
import { cn } from "@/lib/utils";

interface BudgetState {
  rangeKey: string;
  budgetMin: number;
  budgetMax: number;
  paymentStyle: PaymentStyle;
}

interface StepBudgetProps {
  value: BudgetState;
  onChange: (value: BudgetState) => void;
}

export function StepBudget({ value, onChange }: StepBudgetProps) {
  const handleRange = (opt: (typeof BUDGET_RANGE_OPTIONS)[number]) => {
    onChange({
      ...value,
      rangeKey: opt.value,
      budgetMin: opt.budgetMin,
      budgetMax: opt.budgetMax,
    });
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-title-sm text-ink font-medium">
          월 납입금 범위를 선택해 주세요
        </h2>
        <p className="text-label text-ink-label mt-1">
          보증금·선납금 제외한 순수 월 납입 기준이에요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {BUDGET_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleRange(opt)}
            className={cn(
              "py-4 px-4 rounded-card border text-base font-medium transition-all duration-200",
              value.rangeKey === opt.value
                ? "border-primary bg-primary-100 text-primary"
                : "border-neutral-800 bg-white text-ink hover:border-primary-200 hover:shadow-card-hover hover:-translate-y-0.5"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export type { BudgetState };
