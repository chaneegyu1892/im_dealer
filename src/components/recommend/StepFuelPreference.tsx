import { FUEL_PREFERENCE_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepFuelPreferenceProps {
  value: string;
  onChange: (value: string) => void;
}

export function StepFuelPreference({ value, onChange }: StepFuelPreferenceProps) {
  return (
    <div className="space-y-3">
      <div className="mb-6">
        <h2 className="text-title-sm text-ink font-medium">연료 방식에 선호가 있으신가요?</h2>
        <p className="text-label text-ink-label mt-1">선호하는 연료 방식이 있다면 그에 맞게 추천해 드려요.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FUEL_PREFERENCE_OPTIONS.map((opt) => (
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
