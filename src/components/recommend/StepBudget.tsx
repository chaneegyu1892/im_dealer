import {
  BUDGET_RANGE_OPTIONS,
  PAYMENT_STYLE_OPTIONS,
  BUDGET_DETAIL_OPTIONS,
  BUDGET_DETAIL_QUESTION,
} from "@/constants/recommend-options";
import type { PaymentStyle } from "@/types/recommendation";
import { SelectionCard } from "./SelectionCard";
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
  detail: string;
  onDetailChange: (value: string) => void;
}

export function StepBudget({ value, onChange, detail, onDetailChange }: StepBudgetProps) {
  const handleRange = (opt: (typeof BUDGET_RANGE_OPTIONS)[number]) => {
    onChange({
      ...value,
      rangeKey: opt.value,
      budgetMin: opt.budgetMin,
      budgetMax: opt.budgetMax,
    });
  };

  const handleStyle = (style: PaymentStyle) => {
    onChange({ ...value, paymentStyle: style });
  };

  const detailOptions = BUDGET_DETAIL_OPTIONS[value.paymentStyle] ?? [];
  const detailQuestion = BUDGET_DETAIL_QUESTION[value.paymentStyle];

  return (
    <div className="space-y-8">
      {/* 예산 범위 */}
      <div>
        <div className="mb-4">
          <h2 className="text-title-sm text-ink font-medium">
            월 납입금 범위를 선택해 주세요
          </h2>
          <p className="text-label text-ink-label mt-1">
            보증금·선납금 제외한 순수 월 납입 기준이에요.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {BUDGET_RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleRange(opt)}
              className={cn(
                "py-3 px-4 rounded-btn border text-sm font-medium transition-all duration-200",
                value.rangeKey === opt.value
                  ? "border-primary bg-primary-100 text-primary"
                  : "border-neutral-800 bg-white text-ink hover:border-primary-200"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 납입 성향 */}
      <div>
        <div className="mb-4">
          <h2 className="text-title-sm text-ink font-medium">
            납입 방식 성향을 골라주세요
          </h2>
          <p className="text-label text-ink-label mt-1">
            보증금·선납금 활용 여부로 월 납입금이 달라져요.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {PAYMENT_STYLE_OPTIONS.map((opt) => (
            <SelectionCard
              key={opt.value}
              label={opt.label}
              desc={opt.desc}
              detail={opt.detail}
              selected={value.paymentStyle === opt.value}
              recommended={"recommended" in opt ? opt.recommended : false}
              onClick={() => handleStyle(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* 납입방식별 추가 질문 — 예산 범위 선택 후 표시 */}
      {value.rangeKey && detailQuestion && (
        <div key={value.paymentStyle} className="pt-2 border-t border-[#F0F0F0] animate-slide-down">
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1.5">
              추가 질문
            </p>
            <h3 className="text-base font-medium text-ink">{detailQuestion.title}</h3>
            <p className="text-[13px] text-ink-label mt-0.5">{detailQuestion.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {detailOptions.map((opt) => (
              <SelectionCard
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                icon={opt.icon}
                selected={detail === opt.value}
                onClick={() => onDetailChange(opt.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type { BudgetState };
