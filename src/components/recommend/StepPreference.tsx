import {
  PREFERENCE_OPTIONS,
  PREFERENCE_DETAIL_OPTIONS,
  PREFERENCE_DETAIL_QUESTION,
  MAX_PREFERENCES,
} from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

interface StepPreferenceProps {
  /** 선택한 선호 특징 value 배열 (최대 2개) */
  selected: string[];
  onToggle: (value: string) => void;
  /** 상황형 상세 — "가족" 선택 시 자녀연령 */
  childDetail: string;
  onChildDetailChange: (value: string) => void;
  /** 상황형 상세 — "화물" 선택 시 소형/대형 */
  cargoDetail: string;
  onCargoDetailChange: (value: string) => void;
}

export function StepPreference({
  selected,
  onToggle,
  childDetail,
  onChildDetailChange,
  cargoDetail,
  onCargoDetailChange,
}: StepPreferenceProps) {
  const atMax = selected.length >= MAX_PREFERENCES;

  // 선택된 상황형(가족/화물) — 1개만 선택 가능하므로 최대 1개
  const situation = selected.find((v) => v === "가족" || v === "화물");
  const detailValue = situation === "가족" ? childDetail : cargoDetail;
  const onDetailChange =
    situation === "가족" ? onChildDetailChange : onCargoDetailChange;
  const detailOptions = situation
    ? PREFERENCE_DETAIL_OPTIONS[situation] ?? []
    : [];
  const detailQuestion = situation ? PREFERENCE_DETAIL_QUESTION[situation] : null;

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <span className="t-kick">STEP 02</span>
        <h2 className="t-h1 mt-2">
          어떤 <span className="text-brand">차를 원하세요</span>?
        </h2>
        <p className="t-sub mt-2">
          가장 가까운 걸로 최대 {MAX_PREFERENCES}개까지 골라주세요.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PREFERENCE_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.value);
          // 미선택 + 이미 2개 선택됨 → 추가 불가 (시각적으로 흐리게)
          const blocked = !isSelected && atMax;
          return (
            <div key={opt.value} className={blocked ? "opacity-40" : undefined}>
              <SelectionCard
                label={opt.label}
                desc={opt.desc}
                icon={opt.icon}
                selected={isSelected}
                onClick={() => {
                  if (blocked) return;
                  onToggle(opt.value);
                }}
              />
            </div>
          );
        })}
      </div>

      {situation && detailQuestion && (
        <div key={situation} className="t-gray mt-6 animate-slide-down p-4">
          <div className="mb-4">
            <span className="t-kick text-[11px]">추가 질문</span>
            <h3 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-ink">
              {detailQuestion.title}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-g2">
              {detailQuestion.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {detailOptions.map((opt) => (
              <SelectionCard
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                icon={opt.icon}
                selected={detailValue === opt.value}
                onClick={() => onDetailChange(opt.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
