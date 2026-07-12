import type { OverlapProfile, SuitabilityLevel } from "@/lib/recommend/overlap-profile";
import ProfileLevelGroup from "./ProfileLevelGroup";

interface Props {
  readonly profile: OverlapProfile;
  readonly onChange: (profile: OverlapProfile) => void;
}

export default function ProfileScoreEditor({ profile, onChange }: Props) {
  const scores = profile.scores;
  const updateIndustry = (key: keyof typeof scores.industry, value: SuitabilityLevel) => onChange({
    ...profile,
    scores: { ...scores, industry: { ...scores.industry, [key]: value } },
  });
  const updatePrimary = (key: keyof typeof scores.primaryPreference, value: SuitabilityLevel) => onChange({
    ...profile,
    scores: { ...scores, primaryPreference: { ...scores.primaryPreference, [key]: value } },
  });
  const updateFamily = (key: keyof typeof scores.additionalCondition.family.details, value: SuitabilityLevel) => onChange({
    ...profile,
    scores: {
      ...scores,
      additionalCondition: {
        ...scores.additionalCondition,
        family: { ...scores.additionalCondition.family, details: { ...scores.additionalCondition.family.details, [key]: value } },
      },
    },
  });
  const updateCargo = (key: keyof typeof scores.additionalCondition.cargo.details, value: SuitabilityLevel) => onChange({
    ...profile,
    scores: {
      ...scores,
      additionalCondition: {
        ...scores.additionalCondition,
        cargo: { ...scores.additionalCondition.cargo, details: { ...scores.additionalCondition.cargo.details, [key]: value } },
      },
    },
  });
  const updateMileage = (key: keyof typeof scores.annualMileage, value: SuitabilityLevel) => onChange({
    ...profile,
    scores: { ...scores, annualMileage: { ...scores.annualMileage, [key]: value } },
  });
  const updateRegion = (key: keyof typeof scores.region, value: SuitabilityLevel) => onChange({
    ...profile,
    scores: { ...scores, region: { ...scores.region, [key]: value } },
  });

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ProfileLevelGroup title="등록 형태" entries={[
        { key: "법인", label: "법인", value: scores.industry.법인 },
        { key: "개인사업자", label: "개인사업자", value: scores.industry.개인사업자 },
        { key: "개인", label: "개인", value: scores.industry.개인 },
      ]} onChange={updateIndustry} />
      <ProfileLevelGroup title="차종 기준" entries={[
        { key: "안정감", label: "안정감", value: scores.primaryPreference.안정감 },
        { key: "주차편의", label: "주차편의", value: scores.primaryPreference.주차편의 },
        { key: "경제성", label: "경제성", value: scores.primaryPreference.경제성 },
        { key: "고급", label: "고급", value: scores.primaryPreference.고급 },
      ]} onChange={updatePrimary} />
      <fieldset className="space-y-3 rounded-2xl border border-[#E8EAF2] p-3">
        <legend className="px-1 text-xs font-bold text-[#1A1A2E]">가족 조건</legend>
        <ProfileLevelGroup title="부모 기본" entries={[{ key: "default", label: "가족", value: scores.additionalCondition.family.default }]} onChange={(_key, value) => onChange({
          ...profile,
          scores: { ...scores, additionalCondition: { ...scores.additionalCondition, family: { ...scores.additionalCondition.family, default: value } } },
        })} />
        <ProfileLevelGroup title="자녀 연령" entries={[
          { key: "영유아", label: "영유아", value: scores.additionalCondition.family.details.영유아 },
          { key: "미취학", label: "미취학", value: scores.additionalCondition.family.details.미취학 },
          { key: "초등", label: "초등", value: scores.additionalCondition.family.details.초등 },
          { key: "중학생+", label: "중학생+", value: scores.additionalCondition.family.details["중학생+"] },
        ]} onChange={updateFamily} />
      </fieldset>
      <fieldset className="space-y-3 rounded-2xl border border-[#E8EAF2] p-3">
        <legend className="px-1 text-xs font-bold text-[#1A1A2E]">화물 조건</legend>
        <ProfileLevelGroup title="부모 기본" entries={[{ key: "default", label: "화물", value: scores.additionalCondition.cargo.default }]} onChange={(_key, value) => onChange({
          ...profile,
          scores: { ...scores, additionalCondition: { ...scores.additionalCondition, cargo: { ...scores.additionalCondition.cargo, default: value } } },
        })} />
        <ProfileLevelGroup title="화물 종류" entries={[
          { key: "소형 박스", label: "소형 박스", value: scores.additionalCondition.cargo.details["소형 박스"] },
          { key: "대형 화물", label: "대형 화물", value: scores.additionalCondition.cargo.details["대형 화물"] },
        ]} onChange={updateCargo} />
      </fieldset>
      <ProfileLevelGroup title="연간 주행거리" entries={[
        { key: "10000", label: "1만km", value: scores.annualMileage["10000"] },
        { key: "20000", label: "2만km", value: scores.annualMileage["20000"] },
        { key: "30000", label: "3만km", value: scores.annualMileage["30000"] },
      ]} onChange={updateMileage} />
      <ProfileLevelGroup title="운행 지역" entries={[
        { key: "일반", label: "일반", value: scores.region.일반 },
        { key: "강원·산간", label: "강원·산간", value: scores.region["강원·산간"] },
        { key: "제주", label: "제주", value: scores.region.제주 },
      ]} onChange={updateRegion} />
      {profile.fuelGroup === "EV" && <ProfileLevelGroup title="EV 충전환경" entries={[
        { key: "자택", label: "자택", value: profile.chargingFit.자택 },
        { key: "직장", label: "직장", value: profile.chargingFit.직장 },
        { key: "외부", label: "외부", value: profile.chargingFit.외부 },
        { key: "없음", label: "없음", value: profile.chargingFit.없음 },
      ]} onChange={(key, value) => onChange({ ...profile, chargingFit: { ...profile.chargingFit, [key]: value } })} />}
    </div>
  );
}
