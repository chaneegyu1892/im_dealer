import { BUDGET_DETAIL_OPTIONS, BUDGET_DETAIL_QUESTION } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";
import type { PaymentStyle } from "@/types/recommendation";

interface StepBudgetDetailProps {
  paymentStyle: PaymentStyle;
  value: string;
  onChange: (value: string) => void;
}

export function StepBudgetDetail({ paymentStyle, value, onChange }: StepBudgetDetailProps) {
  const options = BUDGET_DETAIL_OPTIONS[paymentStyle] ?? [];
  const question = BUDGET_DETAIL_QUESTION[paymentStyle] ?? { title: "조금 더 알려주세요", subtitle: "" };

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h2 className="text-title-sm text-ink font-medium">{question.title}</h2>
        <p className="text-label text-ink-label mt-1">{question.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => (
          <SelectionCard
            key={opt.value}
            label={opt.label}
            desc={opt.desc}
            icon={opt.icon}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}
