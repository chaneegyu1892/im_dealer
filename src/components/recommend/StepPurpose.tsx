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
      <div className="mb-6">
        <span className="t-kick">STEP 02</span>
        <h2 className="t-h1 mt-2">
          주로 <span className="text-brand">어디에</span> 쓰시나요?
        </h2>
        <p className="t-sub mt-2">
          사용 목적에 맞는 차종과 조건을 추천해 드려요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div key={value} className="t-gray mt-6 animate-slide-down p-4">
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
