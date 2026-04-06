import { PURPOSE_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepPurposeProps {
  value: string;
  onChange: (value: string) => void;
}

export function StepPurpose({ value, onChange }: StepPurposeProps) {
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
    </div>
  );
}
