import { REGION_OPTIONS } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

type Region = typeof REGION_OPTIONS[number]["value"];

interface StepRegionProps {
  value: Region;
  onChange: (value: Region) => void;
}

export function StepRegion({ value, onChange }: StepRegionProps) {
  return (
    <div className="space-y-3">
      <div className="mb-5">
        <h2 className="text-[19px] font-semibold leading-tight text-ink md:text-title-sm md:font-medium">주로 어느 지역에서 운행하시나요?</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-label">지역 특성에 맞는 차량을 추천해 드려요.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {REGION_OPTIONS.map((opt) => (
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
