import type { OverlapScoringInput } from "./overlap-scoring";

const industries = [
  { value: "법인", details: ["없음", "1대", "2대 이상"] },
  { value: "개인사업자", details: ["없음", "1대", "2대 이상"] },
  { value: "개인", details: ["혼자", "2~3명", "4명 이상"] },
] as const;
const primaries = [undefined, "안정감", "주차편의", "경제성", "고급"] as const;
const mileages = [10_000, 20_000, 30_000] as const;
const regions = ["일반", "강원·산간", "제주"] as const;
const charging = ["자택", "직장", "외부", "없음"] as const;

type Situation =
  | { readonly situationPreference?: undefined }
  | { readonly situationPreference: "가족"; readonly childDetail: "영유아" | "미취학" | "초등" | "중학생+" }
  | { readonly situationPreference: "화물"; readonly cargoDetail: "소형 박스" | "대형 화물" };

const situations: readonly Situation[] = [
  {},
  { situationPreference: "가족", childDetail: "영유아" },
  { situationPreference: "가족", childDetail: "미취학" },
  { situationPreference: "가족", childDetail: "초등" },
  { situationPreference: "가족", childDetail: "중학생+" },
  { situationPreference: "화물", cargoDetail: "소형 박스" },
  { situationPreference: "화물", cargoDetail: "대형 화물" },
];

export function generateOverlapAuditInputs(): readonly OverlapScoringInput[] {
  const inputs: OverlapScoringInput[] = [];
  for (const industry of industries) for (const industryDetail of industry.details) {
    for (const primaryPreference of primaries) for (const situation of situations) {
      for (const annualMileage of mileages) for (const residenceRegion of regions) {
        for (const fuelPreference of ["상관없음", "가솔린/디젤", "하이브리드"] as const) {
          inputs.push({ industry: industry.value, industryDetail, primaryPreference, ...situation, annualMileage, residenceRegion, fuelPreference });
        }
        for (const chargingEnvironment of charging) {
          inputs.push({ industry: industry.value, industryDetail, primaryPreference, ...situation, annualMileage, residenceRegion, fuelPreference: "전기차", chargingEnvironment });
        }
      }
    }
  }
  return inputs;
}

export function overlapAuditInputKey(input: OverlapScoringInput): string {
  return JSON.stringify(input);
}
