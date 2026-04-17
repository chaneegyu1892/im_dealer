import { INDUSTRY_DETAIL_OPTIONS, INDUSTRY_DETAIL_QUESTION } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepIndustryDetailProps {
  industry: string;
  value: string;
  onChange: (value: string) => void;
}

export function StepIndustryDetail({ industry, value, onChange }: StepIndustryDetailProps) {
  const options = INDUSTRY_DETAIL_OPTIONS[industry] ?? [];
  const question = INDUSTRY_DETAIL_QUESTION[industry] ?? { title: "조금 더 알려주세요", subtitle: "" };

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
