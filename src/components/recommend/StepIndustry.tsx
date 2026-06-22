import { INDUSTRY_OPTIONS, INDUSTRY_DETAIL_OPTIONS, INDUSTRY_DETAIL_QUESTION } from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepIndustryProps {
  value: string;
  onChange: (value: string) => void;
  detail: string;
  onDetailChange: (value: string) => void;
}

export function StepIndustry({ value, onChange, detail, onDetailChange }: StepIndustryProps) {
  const detailOptions = value ? INDUSTRY_DETAIL_OPTIONS[value] ?? [] : [];
  const detailQuestion = value ? INDUSTRY_DETAIL_QUESTION[value] : null;

  return (
    <div className="space-y-3">
      <div className="mb-5">
        <h2 className="text-[19px] font-semibold leading-tight text-ink md:text-title-sm md:font-medium">
          어떤 형태로 차량을 등록하실 건가요?
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-public-muted md:text-label">
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

      {value && detailQuestion && (
        <div key={value} className="mt-5 animate-slide-down rounded-[16px] border border-public-border bg-public-bg p-4">
          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
              추가 질문
            </p>
            <h3 className="text-[15px] font-semibold text-ink">{detailQuestion.title}</h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-public-muted">{detailQuestion.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {detailOptions.map((opt) => (
              <SelectionCard
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                icon={opt.icon}
                selected={detail === opt.value}
                onClick={() => onDetailChange(opt.value)}
              />
            ))}
          </div>

          {value === "개인사업자" && detail === "2대 이상" && (
            <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3">
              <p className="text-[12px] leading-relaxed text-amber-800">
                사업자 명의 차량을 2대 이상 운용하시는 경우 <span className="font-semibold">임직원 전용 보험</span>이 필요합니다.
                자세한 안내가 필요하시면 상담을 이용해 주세요.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
