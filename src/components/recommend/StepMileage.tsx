import { MILEAGE_OPTIONS } from "@/constants/recommend-options";
import { cn } from "@/lib/utils";

interface StepMileageProps {
  value: number;
  onChange: (value: number) => void;
}

export function StepMileage({ value, onChange }: StepMileageProps) {
  return (
    <div>
      <div className="mb-5">
        <span className="t-kick">STEP 03</span>
        <h2 className="t-h1 mt-2">
          연간 <span className="text-brand">얼마나</span> 주행하세요?
        </h2>
        <p className="t-sub mt-2">
          약정거리를 초과하면 추가 요금이 발생해요.
        </p>
      </div>

      <div className="mb-4 rounded-[14px] bg-brand-soft p-3.5">
        <p className="text-[12.5px] leading-relaxed text-brand">
          고객 선택이 가장 많은 기준은 <span className="font-extrabold">연 2만km</span>입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
        {MILEAGE_OPTIONS.map((opt) => {
          const isRecommended = "recommended" in opt && opt.recommended;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "relative rounded-[14px] border-[1.5px] p-4 text-left transition-colors active:scale-[0.99] md:min-h-[96px] md:p-5",
                value === opt.value
                  ? "border-brand bg-brand-soft"
                  : "border-line2 bg-white"
              )}
            >
              {isRecommended && (
                <span className="absolute -top-2 left-3 rounded-pill bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                  추천
                </span>
              )}
              <p
                className={cn(
                  "text-[15px] font-extrabold",
                  value === opt.value ? "text-brand" : "text-ink"
                )}
              >
                {opt.label}
              </p>
              <p className="mt-0.5 text-[12.5px] text-g2">{opt.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
