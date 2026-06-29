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
      <div className="mb-6">
        <span className="t-kick">STEP 01</span>
        <h2 className="t-h1 mt-2">
          어떤 형태로 <span className="text-brand">차량을 등록</span>하실 건가요?
        </h2>
        <p className="t-sub mt-2">
          등록 형태에 따라 세제 혜택과 견적 조건이 달라져요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div key={value} className="t-gray mt-6 animate-slide-down p-4">
          <div className="mb-4">
            <span className="t-kick text-[11px]">추가 질문</span>
            <h3 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-ink">{detailQuestion.title}</h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-g2">{detailQuestion.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
