import {
  PURPOSE_DETAIL_OPTIONS,
  PURPOSE_DETAIL_QUESTION,
  getPurposeOptionsForIndustry,
} from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepPurposeProps {
  industry: string;
  value: string;
  onChange: (value: string) => void;
  detail: string;
  onDetailChange: (value: string) => void;
}

export function StepPurpose({ industry, value, onChange, detail, onDetailChange }: StepPurposeProps) {
  const purposeOptions = getPurposeOptionsForIndustry(industry);
  const detailOptions = value ? PURPOSE_DETAIL_OPTIONS[value] ?? [] : [];
  const detailQuestion = value ? PURPOSE_DETAIL_QUESTION[value] : null;

  return (
    <div className="space-y-3">
      <div className="mb-5">
        <h2 className="text-[19px] font-semibold leading-tight text-ink md:text-title-sm md:font-medium">
          차량을 주로 어떤 용도로 사용하실 건가요?
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-label">
          사용 목적에 맞는 차종과 조건을 추천해 드려요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {purposeOptions.map((opt) => (
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

      {value && detailQuestion && (
        <div key={value} className="mt-5 animate-slide-down rounded-[16px] border border-public-border bg-public-bg p-4">
          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
              추가 질문
            </p>
            <h3 className="text-[15px] font-semibold text-ink">{detailQuestion.title}</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-public-muted">{detailQuestion.subtitle}</p>
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
