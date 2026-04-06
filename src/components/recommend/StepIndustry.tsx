import { INDUSTRY_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepIndustryProps {
  value: string;
  onChange: (value: string) => void;
}

export function StepIndustry({ value, onChange }: StepIndustryProps) {
  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h2 className="text-title-sm text-ink font-medium">
          어떤 형태로 차량을 등록하실 건가요?
        </h2>
        <p className="text-label text-ink-label mt-1">
          등록 형태에 따라 세제 혜택과 견적 조건이 달라져요.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INDUSTRY_OPTIONS.map((opt) => (
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
