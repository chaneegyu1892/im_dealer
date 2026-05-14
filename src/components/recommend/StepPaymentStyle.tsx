import {
  PAYMENT_STYLE_OPTIONS,
  BUDGET_DETAIL_OPTIONS,
  BUDGET_DETAIL_QUESTION,
} from "@/constants/recommend-options";
import type { PaymentStyle } from "@/types/recommendation";
import { SelectionCard } from "./SelectionCard";

interface StepPaymentStyleProps {
  value: PaymentStyle;
  onChange: (value: PaymentStyle) => void;
  detail: string;
  onDetailChange: (value: string) => void;
}

export function StepPaymentStyle({ value, onChange, detail, onDetailChange }: StepPaymentStyleProps) {
  const detailOptions = BUDGET_DETAIL_OPTIONS[value] ?? [];
  const detailQuestion = BUDGET_DETAIL_QUESTION[value];

  return (
    <div className="space-y-6">
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
              selected={value === opt.value}
              recommended={"recommended" in opt ? opt.recommended : false}
              onClick={() => onChange(opt.value)}
            />
          ))}
        </div>
      </div>

      {value && detailQuestion && (
        <div key={value} className="pt-2 border-t border-[#F0F0F0] animate-slide-down">
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
