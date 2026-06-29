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
        <div className="mb-5">
          <span className="t-kick">STEP 05</span>
          <h2 className="t-h1 mt-2">
            <span className="text-brand">납입 방식</span> 성향을 골라주세요
          </h2>
          <p className="t-sub mt-2">
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
        <div key={value} className="animate-slide-down border-t border-line pt-5">
          <div className="mb-4">
            <span className="t-kick text-[11px]">추가 질문</span>
            <h3 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-ink">{detailQuestion.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-g2">{detailQuestion.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
