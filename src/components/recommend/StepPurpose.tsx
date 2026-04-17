import { PURPOSE_OPTIONS, PURPOSE_DETAIL_OPTIONS, PURPOSE_DETAIL_QUESTION } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepPurposeProps {
  value: string;
  onChange: (value: string) => void;
  detail: string;
  onDetailChange: (value: string) => void;
}

export function StepPurpose({ value, onChange, detail, onDetailChange }: StepPurposeProps) {
  const detailOptions = value ? PURPOSE_DETAIL_OPTIONS[value] ?? [] : [];
  const detailQuestion = value ? PURPOSE_DETAIL_QUESTION[value] : null;

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h2 className="text-title-sm text-ink font-medium">
          차량을 주로 어떤 용도로 사용하실 건가요?
        </h2>
        <p className="text-label text-ink-label mt-1">
          사용 목적에 맞는 차종과 조건을 추천해 드려요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PURPOSE_OPTIONS.map((opt) => (
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
        <div key={value} className="mt-6 pt-6 border-t border-[#F0F0F0] animate-slide-down">
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
