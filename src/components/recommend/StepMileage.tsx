import { MILEAGE_OPTIONS } from "@/constants/recommend-options";
import { cn } from "@/lib/utils";

interface StepMileageProps {
  value: number;
  onChange: (value: number) => void;
}

export function StepMileage({ value, onChange }: StepMileageProps) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[19px] font-semibold leading-tight text-ink md:text-title-sm md:font-medium">
          연간 주행거리는 얼마나 되시나요?
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-label">
          약정거리를 초과하면 추가 요금이 발생해요.
        </p>
      </div>

      <div className="mb-3 rounded-[14px] border border-primary/15 bg-primary/[0.04] p-3">
        <p className="text-[12px] leading-relaxed text-primary">
          고객 선택이 가장 많은 기준은 <span className="font-semibold">연 2만km</span>입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MILEAGE_OPTIONS.map((opt) => {
          const isRecommended = "recommended" in opt && opt.recommended;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "relative rounded-[14px] border p-4 text-left transition-all duration-200 active:scale-[0.99]",
                value === opt.value
                  ? "border-primary bg-primary/[0.06]"
                  : "border-public-border bg-white hover:border-primary/25"
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-semibold">
                  추천
                </span>
              )}
              <p
                className={cn(
                  "text-sm font-medium",
                  value === opt.value ? "text-primary" : "text-ink"
                )}
              >
                {opt.label}
              </p>
              <p className="text-[12px] text-ink-caption mt-0.5">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
