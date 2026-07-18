import { CHARGING_OPTIONS } from "@/constants/recommend-options";
import type { RecommendFlowState } from "./recommend-flow-state";
import { SelectionCard } from "./SelectionCard";
import { StepFuelPreference } from "./StepFuelPreference";
import { StepMileage } from "./StepMileage";
import { StepRegion } from "./StepRegion";

type UsageState = Pick<
  RecommendFlowState,
  "annualMileage" | "fuelPreference" | "chargingEnvironment" | "residenceRegion"
>;

interface StepUsageProps {
  readonly value: UsageState;
  readonly onChange: (patch: Partial<UsageState>) => void;
}

export function StepUsage({ value, onChange }: StepUsageProps) {
  const handleFuelChange = (fuelPreference: string) => {
    onChange({
      fuelPreference,
      chargingEnvironment:
        fuelPreference === "전기차" ? value.chargingEnvironment : "",
    });
  };

  return (
    <div className="space-y-8">
      <StepMileage
        value={value.annualMileage}
        onChange={(annualMileage) => onChange({ annualMileage })}
      />
      <div className="border-t border-border-subtle pt-7">
        <StepFuelPreference
          value={value.fuelPreference}
          onChange={handleFuelChange}
        />
        {value.fuelPreference === "전기차" && (
          <div className="mt-5 rounded-[16px] border border-brand/15 bg-brand-soft p-4 transition-all duration-200">
            <h3 className="text-[15px] font-extrabold text-text-strong">
              충전 환경이 있나요?
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
              집·회사·아파트 등 일상 충전이 가능한지에 따라 추천이 달라져요.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              {CHARGING_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.value}
                  selected={value.chargingEnvironment === option.value}
                  onClick={() => onChange({
                    chargingEnvironment: option.value,
                  })}
                  icon={option.icon}
                  label={option.label}
                  desc={option.desc}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border-subtle pt-7">
        <StepRegion
          value={value.residenceRegion}
          onChange={(residenceRegion) => onChange({ residenceRegion })}
        />
      </div>
    </div>
  );
}
