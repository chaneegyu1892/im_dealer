import {
  overlapProfileSchema,
  parseOverlapProfile,
  type FuelGroup,
  type OverlapProfile,
} from "@/lib/recommend/overlap-profile";
import type { VehicleAiConfigDto } from "@/types/admin-ai";

const emptyScores = () => ({
  industry: { 법인: "none", 개인사업자: "none", 개인: "none" },
  primaryPreference: { 안정감: "none", 주차편의: "none", 경제성: "none", 고급: "none" },
  additionalCondition: {
    family: { default: "none", details: { 영유아: "none", 미취학: "none", 초등: "none", "중학생+": "none" } },
    cargo: { default: "none", details: { "소형 박스": "none", "대형 화물": "none" } },
  },
  annualMileage: { "10000": "none", "20000": "none", "30000": "none" },
  region: { 일반: "none", "강원·산간": "none", 제주: "none" },
});

export function createBlankProfile(fuelGroup: FuelGroup): OverlapProfile {
  const common = {
    version: "overlap-v2",
    fuelGroup,
    scores: emptyScores(),
    companyPriority: 0,
    profitPriority: 0,
  };
  return overlapProfileSchema.parse(fuelGroup === "EV"
    ? { ...common, chargingFit: { 자택: "none", 직장: "none", 외부: "none", 없음: "none" } }
    : common);
}

export function initialProfileDraft(row: VehicleAiConfigDto): OverlapProfile {
  const parsed = row.config ? parseOverlapProfile(row.config.profile) : null;
  return parsed?.kind === "valid" ? parsed.profile : createBlankProfile(row.fuelGroup ?? "ICE");
}

export function changeProfileFuel(profile: OverlapProfile, fuelGroup: FuelGroup): OverlapProfile {
  const common = {
    version: "overlap-v2",
    fuelGroup,
    scores: profile.scores,
    companyPriority: profile.companyPriority,
    profitPriority: profile.profitPriority,
  };
  return overlapProfileSchema.parse(fuelGroup === "EV" ? {
    ...common,
    chargingFit: profile.fuelGroup === "EV"
      ? profile.chargingFit
      : { 자택: "none", 직장: "none", 외부: "none", 없음: "none" },
  } : common);
}
