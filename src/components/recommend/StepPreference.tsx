import {
  PREFERENCE_OPTIONS,
  PREFERENCE_DETAIL_OPTIONS,
  PREFERENCE_DETAIL_QUESTION,
  NO_SIMPLE_PREFERENCE_VALUE,
  NO_SITUATION_PREFERENCE_VALUE,
} from "@/constants/recommend-options";
import { SelectionCard } from "./SelectionCard";

type SituationPreference = "가족" | "화물";

interface StepPreferenceProps {
  simpleValue: string;
  onSimpleChange: (value: string) => void;
  situationValue: string;
  onSituationChange: (value: string) => void;
  childDetail: string;
  onChildDetailChange: (value: string) => void;
  cargoDetail: string;
  onCargoDetailChange: (value: string) => void;
}

const SIMPLE_NONE_OPTION = {
  value: NO_SIMPLE_PREFERENCE_VALUE,
  label: "해당 없음",
  desc: "딱 맞는 차종 기준이 없어요",
  icon: "",
  kind: "feel",
} as const;

const SITUATION_NONE_OPTION = {
  value: NO_SITUATION_PREFERENCE_VALUE,
  label: "해당 없음",
  desc: "추가 조건이 따로 없어요",
  icon: "",
  kind: "situation",
} as const;

function isSituationPreference(value: string): value is SituationPreference {
  return value === "가족" || value === "화물";
}

export function StepPreference({
  simpleValue,
  onSimpleChange,
  situationValue,
  onSituationChange,
  childDetail,
  onChildDetailChange,
  cargoDetail,
  onCargoDetailChange,
}: StepPreferenceProps) {
  const situation = isSituationPreference(situationValue) ? situationValue : "";
  const detailValue = situation === "가족" ? childDetail : cargoDetail;
  const onDetailChange =
    situation === "가족" ? onChildDetailChange : onCargoDetailChange;
  const detailOptions = situation
    ? PREFERENCE_DETAIL_OPTIONS[situation] ?? []
    : [];
  const detailQuestion = situation ? PREFERENCE_DETAIL_QUESTION[situation] : null;

  const feelOptions = [
    ...PREFERENCE_OPTIONS.filter((o) => o.kind === "feel"),
    SIMPLE_NONE_OPTION,
  ];
  const situationOptions = [
    ...PREFERENCE_OPTIONS.filter((o) => o.kind === "situation"),
    SITUATION_NONE_OPTION,
  ];

  const renderSimpleCard = (opt: (typeof feelOptions)[number]) => {
    const isSelected = simpleValue === opt.value;
    return (
      <SelectionCard
        key={opt.value}
        label={opt.label}
        desc={opt.desc}
        icon={opt.icon}
        selected={isSelected}
        onClick={() => onSimpleChange(opt.value)}
      />
    );
  };

  const renderSituationCard = (opt: (typeof situationOptions)[number]) => {
    const isSelected = situationValue === opt.value;
    return (
      <SelectionCard
        key={opt.value}
        label={opt.label}
        desc={opt.desc}
        icon={opt.icon}
        selected={isSelected}
        onClick={() => onSituationChange(opt.value)}
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <span className="t-kick">STEP 02</span>
        <h2 className="t-h1 mt-2">
          어떤 <span className="text-brand">차를 원하세요</span>?
        </h2>
        <p className="t-sub mt-2">
          차종 기준과 추가 조건을 각각 하나씩 골라주세요.
        </p>
      </div>

      <section aria-labelledby="simplePreferenceTitle" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="t-kick text-[11px]">차종 기준</span>
            <h3 id="simplePreferenceTitle" className="mt-1 text-[16px] font-extrabold text-text-strong">
              먼저 가장 중요한 방향을 골라주세요
            </h3>
          </div>
          <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
            1개 선택
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {feelOptions.map(renderSimpleCard)}
        </div>
      </section>

      <section aria-labelledby="situationPreferenceTitle" className="space-y-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="t-kick text-[11px]">추가 조건</span>
            <h3 id="situationPreferenceTitle" className="mt-1 text-[16px] font-extrabold text-text-strong">
              아이나 짐 관련 조건이 있나요?
            </h3>
          </div>
          <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
            1개 선택
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {situationOptions.map(renderSituationCard)}
        </div>
      </section>

      {situation && detailQuestion && (
        <div key={situation} className="t-gray mt-6 animate-slide-down p-4">
          <div className="mb-4">
            <span className="t-kick text-[11px]">추가 질문</span>
            <h3 className="mt-1.5 text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-text-strong">
              {detailQuestion.title}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">
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
