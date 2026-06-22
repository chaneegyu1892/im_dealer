import { FUEL_PREFERENCE_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepFuelPreferenceProps {
  value: string;
  onChange: (value: string) => void;
  budgetMax?: number;
}

export function StepFuelPreference({ value, onChange, budgetMax }: StepFuelPreferenceProps) {
  const showEvBudgetWarning =
    value === "전기차" && typeof budgetMax === "number" && budgetMax <= 500_000;

  return (
    <div className="space-y-3">
      <div className="mb-5">
        <h2 className="text-[19px] font-semibold leading-tight text-ink md:text-title-sm md:font-medium">연료 방식에 선호가 있으신가요?</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-label">선호하는 연료 방식이 있다면 그에 맞게 추천해 드려요.</p>
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

      {showEvBudgetWarning && (
        <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3">
          <p className="text-[12px] leading-relaxed text-amber-800">
            전기차는 일반 차량 대비 예산이 더 필요할 수 있어요. 추천 결과가 조건과 다를 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
