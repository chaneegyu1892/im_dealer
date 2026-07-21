import {
  PREFERENCE_DETAIL_OPTIONS,
  PREFERENCE_DETAIL_QUESTION,
  NO_SITUATION_PREFERENCE_VALUE,
} from "@/constants/recommend-options";
import { STEP02_V3_STYLE_OPTIONS } from "@/constants/recommend-step02-v3";
import { useRef } from "react";
import { CircleOff } from "lucide-react";
import { SelectionCard } from "./SelectionCard";
import { useRecommendAutoScroll } from "./use-recommend-auto-scroll";

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
  onComplete: () => void;
}

const SITUATION_NONE_OPTION = {
  value: NO_SITUATION_PREFERENCE_VALUE,
  label: "해당 없음",
  desc: "추가 조건이 따로 없어요",
  icon: <CircleOff size={17} aria-hidden />,
  kind: "situation",
} as const;

const SITUATION_OPTIONS = [
  { value: "가족", label: "아이와 함께 타요", desc: "가족·안전 우선", icon: "👨‍👩‍👧" },
  { value: "화물", label: "짐을 많이 실어요", desc: "화물·적재 위주", icon: "📦" },
  SITUATION_NONE_OPTION,
] as const;

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
  onComplete,
}: StepPreferenceProps) {
  const situationRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const requestScroll = useRecommendAutoScroll();
  const situation = isSituationPreference(situationValue) ? situationValue : "";
  const detailValue = situation === "가족" ? childDetail : cargoDetail;
  const onDetailChange =
    situation === "가족" ? onChildDetailChange : onCargoDetailChange;
  const detailOptions = situation
    ? PREFERENCE_DETAIL_OPTIONS[situation] ?? []
    : [];
  const detailQuestion = situation ? PREFERENCE_DETAIL_QUESTION[situation] : null;

  const handleSimpleChange = (value: string) => {
    onSimpleChange(value);
    requestScroll(situationRef);
  };

  const handleSituationChange = (value: string) => {
    onSituationChange(value);
    if (isSituationPreference(value)) {
      requestScroll(detailRef);
      return;
    }

    onComplete();
  };

  const handleDetailChange = (value: string) => {
    onDetailChange(value);
    onComplete();
  };

  const renderSimpleCard = (opt: (typeof STEP02_V3_STYLE_OPTIONS)[number]) => {
    const isSelected = simpleValue === opt.value;
    return (
      <SelectionCard
        key={opt.value}
        label={opt.label}
        desc={opt.desc}
        icon={opt.icon}
        selected={isSelected}
        onClick={() => handleSimpleChange(opt.value)}
      />
    );
  };

  const renderSituationCard = (opt: (typeof SITUATION_OPTIONS)[number]) => {
    const isSelected = situationValue === opt.value;
    return (
      <SelectionCard
        key={opt.value}
        label={opt.label}
        desc={opt.desc}
        icon={opt.icon}
        selected={isSelected}
        onClick={() => handleSituationChange(opt.value)}
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="mb-6">
        <span className="t-kick">STEP 02</span>
        <h2 className="t-h1 mt-2">어떤 스타일의 차를 찾고 계신가요?</h2>
        <p className="t-sub mt-2">
          이용 목적에 맞는 차량 타입을 선택해 주세요
        </p>
      </div>

      <section aria-labelledby="simplePreferenceTitle" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="t-kick text-[11px]">차량 스타일</span>
            <h3 id="simplePreferenceTitle" className="mt-1 text-[16px] font-extrabold text-text-strong">
              가장 가까운 스타일을 하나 골라주세요
            </h3>
          </div>
          <span className="rounded-pill bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
            1개 선택
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STEP02_V3_STYLE_OPTIONS.map(renderSimpleCard)}
        </div>
      </section>

      <section
        ref={situationRef}
        aria-labelledby="situationPreferenceTitle"
        className="scroll-mt-24 space-y-3 pt-4"
      >
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
          {SITUATION_OPTIONS.map(renderSituationCard)}
        </div>
      </section>

      {situation && detailQuestion && (
        <div
          key={situation}
          ref={detailRef}
          className="t-gray mt-6 scroll-mt-24 animate-slide-down p-4"
        >
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
                onClick={() => handleDetailChange(opt.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
