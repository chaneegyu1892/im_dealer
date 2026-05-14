import { MILEAGE_OPTIONS, RETURN_TYPE_OPTIONS, FUEL_PREFERENCE_OPTIONS } from "@/constants/recommend-options";
import type { ReturnType } from "@/types/recommendation";
import { SelectionCard } from "./SelectionCard";
import { cn } from "@/lib/utils";

interface PreferenceState {
  annualMileage: number;
  returnType: ReturnType;
}

interface StepPreferenceProps {
  value: PreferenceState;
  onChange: (value: PreferenceState) => void;
  fuelPreference: string;
  onFuelChange: (value: string) => void;
  budgetMax?: number;
}

export function StepPreference({ value, onChange, fuelPreference, onFuelChange, budgetMax }: StepPreferenceProps) {
  const showEvBudgetWarning =
    fuelPreference === "전기차" && typeof budgetMax === "number" && budgetMax <= 500_000;
  const handleMileage = (mileage: number) => {
    onChange({ ...value, annualMileage: mileage });
  };

  const handleReturnType = (type: ReturnType) => {
    onChange({ ...value, returnType: type });
  };

  return (
    <div className="space-y-8">
      {/* 연간 주행거리 */}
      <div>
        <div className="mb-4">
          <h2 className="text-title-sm text-ink font-medium">
            연간 주행거리는 얼마나 되시나요?
          </h2>
          <p className="text-label text-ink-label mt-1">
            약정거리를 초과하면 추가 요금이 발생해요.
          </p>
        </div>

        <div className="mb-3 rounded-card bg-primary-50 border border-primary-100 p-3">
          <p className="text-[12px] text-primary">
            📊 80%의 고객이 <span className="font-semibold">연 2만km</span>를 선택해요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MILEAGE_OPTIONS.map((opt) => {
            const isRecommended = "recommended" in opt && opt.recommended;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleMileage(opt.value)}
                className={cn(
                  "relative p-4 rounded-card border text-left transition-all duration-200",
                  value.annualMileage === opt.value
                    ? "border-primary bg-primary-100"
                    : "border-[#F0F0F0] bg-white hover:border-primary-200 hover:shadow-card-hover hover:-translate-y-0.5"
                )}
              >
                {isRecommended && (
                  <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-semibold">
                    추천
                  </span>
                )}
                <p className={cn(
                  "text-sm font-medium",
                  value.annualMileage === opt.value ? "text-primary" : "text-ink"
                )}>
                  {opt.label}
                </p>
                <p className="text-[12px] text-ink-caption mt-0.5">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 인수/반납 성향 */}
      <div>
        <div className="mb-4">
          <h2 className="text-title-sm text-ink font-medium">
            계약 종료 후 어떻게 하실 건가요?
          </h2>
          <p className="text-label text-ink-label mt-1">
            모르셔도 괜찮아요. AI가 두 조건 모두 비교해 드려요.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {RETURN_TYPE_OPTIONS.map((opt) => (
            <SelectionCard
              key={opt.value}
              label={opt.label}
              desc={opt.desc}
              detail={opt.detail}
              selected={value.returnType === opt.value}
              onClick={() => handleReturnType(opt.value)}
            />
          ))}
        </div>
      </div>

      {/* 연료 방식 추가 질문 */}
      <div className="pt-2 border-t border-[#F0F0F0]">
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1.5">
            추가 질문
          </p>
          <h3 className="text-base font-medium text-ink">연료 방식에 선호가 있으신가요?</h3>
          <p className="text-[13px] text-ink-label mt-0.5">선호하는 연료 방식이 있다면 그에 맞게 추천해 드려요.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FUEL_PREFERENCE_OPTIONS.map((opt) => (
            <SelectionCard
              key={opt.value}
              label={opt.label}
              desc={opt.desc}
              icon={opt.icon}
              selected={fuelPreference === opt.value}
              onClick={() => onFuelChange(opt.value)}
            />
          ))}
        </div>

        {showEvBudgetWarning && (
          <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3">
            <p className="text-[12px] text-amber-800">
              💡 전기차는 일반 차량 대비 예산이 더 필요할 수 있어요. 추천 결과가 조건과 다를 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export type { PreferenceState };
