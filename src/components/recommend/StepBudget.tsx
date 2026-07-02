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
      <div className="mb-5">
        <span className="t-kick">STEP 04</span>
        <h2 className="t-h1 mt-2">
          월 <span className="text-brand">납입금</span> 범위를 골라주세요
        </h2>
        <p className="t-sub mt-2">
          보증금·선납금 제외한 순수 월 납입 기준이에요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {BUDGET_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleRange(opt)}
            className={cn(
              "rounded-[14px] border-[1.5px] px-4 py-4 text-[15px] font-extrabold transition-colors",
              value.rangeKey === opt.value
                ? "border-brand bg-brand-soft text-brand"
                : "border-border-subtle bg-surface text-text-strong"
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
