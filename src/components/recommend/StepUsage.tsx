import { CHARGING_OPTIONS } from "@/constants/recommend-options";
import { useRef } from "react";
import type { RecommendFlowState } from "./recommend-flow-state";
import { SelectionCard } from "./SelectionCard";
import { StepFuelPreference } from "./StepFuelPreference";
import { StepMileage } from "./StepMileage";
import { StepRegion } from "./StepRegion";
import { useRecommendAutoScroll } from "./use-recommend-auto-scroll";

type UsageState = Pick<
  RecommendFlowState,
  "annualMileage" | "fuelPreference" | "chargingEnvironment" | "residenceRegion"
>;

interface StepUsageProps {
  readonly value: UsageState;
  readonly onChange: (patch: Partial<UsageState>) => void;
  readonly onComplete: () => void;
}

export function StepUsage({ value, onChange, onComplete }: StepUsageProps) {
  const fuelRef = useRef<HTMLDivElement>(null);
  const chargingRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const requestScroll = useRecommendAutoScroll();

  const handleMileageChange = (annualMileage: number) => {
    onChange({ annualMileage });
    requestScroll(fuelRef);
  };

  const handleFuelChange = (fuelPreference: string) => {
    onChange({
      fuelPreference,
      chargingEnvironment:
        fuelPreference === "전기차" ? value.chargingEnvironment : "",
    });
    requestScroll(fuelPreference === "전기차" ? chargingRef : regionRef);
  };

  const handleChargingChange = (
    chargingEnvironment: UsageState["chargingEnvironment"]
  ) => {
    onChange({ chargingEnvironment });
    requestScroll(regionRef);
  };

  const handleRegionChange = (
    residenceRegion: UsageState["residenceRegion"]
  ) => {
    onChange({ residenceRegion });
    onComplete();
  };

  return (
    <div className="space-y-8">
      <StepMileage
        value={value.annualMileage}
        onChange={handleMileageChange}
      />
      <div ref={fuelRef} className="scroll-mt-24 border-t border-border-subtle pt-7">
        <StepFuelPreference
          value={value.fuelPreference}
          onChange={handleFuelChange}
        />
        {value.fuelPreference === "전기차" && (
          <div
            ref={chargingRef}
            className="mt-5 scroll-mt-24 rounded-[16px] border border-brand/15 bg-brand-soft p-4 transition-all duration-200"
          >
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
                  onClick={() => handleChargingChange(option.value)}
                  icon={option.icon}
                  label={option.label}
                  desc={option.desc}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div ref={regionRef} className="scroll-mt-24 border-t border-border-subtle pt-7">
        <StepRegion
          value={value.residenceRegion}
          onChange={handleRegionChange}
        />
      </div>
    </div>
  );
}
