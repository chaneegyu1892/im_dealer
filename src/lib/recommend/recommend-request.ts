import { z } from "zod";
import { RECOMMEND_BUDGET_RANGE_IDS } from "@/constants/recommend-budget";
import { getRecommendationBudgetBounds } from "./recommendation-budget";

const industrySchema = z.enum(["법인", "개인사업자", "개인"]);
const primarySchema = z.enum(["안정감", "주차편의", "경제성", "고급"]);
const situationSchema = z.enum(["가족", "화물"]);
const preferenceSchema = z.enum(["안정감", "주차편의", "경제성", "고급", "가족", "화물"]);
const step02V3StyleSchema = z.enum([
  "family-leisure",
  "city-compact",
  "sedan-comfort",
  "low-running-cost",
  "premium-formal",
  "auto",
]);
const step02V3PreferenceSchema = z.enum([
  "family-leisure",
  "city-compact",
  "sedan-comfort",
  "low-running-cost",
  "premium-formal",
  "auto",
  "가족",
  "화물",
]);
const childSchema = z.enum(["영유아", "미취학", "초등", "중학생+"]);
const cargoSchema = z.enum(["소형 박스", "대형 화물"]);
const fuelSchema = z.enum(["상관없음", "가솔린/디젤", "하이브리드", "전기차"]);
const budgetMaxSchema = z.union([
  z.literal(0),
  z.literal(500_000),
  z.literal(1_000_000),
  z.literal(1_500_000),
]);

const industryDetails = {
  법인: new Set(["없음", "1대", "2대 이상"]),
  개인사업자: new Set(["없음", "1대", "2대 이상"]),
  개인: new Set(["혼자", "2~3명", "4명 이상"]),
};

const legacyRecommendRequestSchema = z.object({
  industry: industrySchema,
  industryDetail: z.string().min(1).optional(),
  budgetMax: budgetMaxSchema.optional(),
  preferences: z.array(preferenceSchema).max(2),
  primaryPreference: primarySchema.optional(),
  situationPreference: situationSchema.optional(),
  childDetail: childSchema.optional(),
  cargoDetail: cargoSchema.optional(),
  annualMileage: z.union([z.literal(10_000), z.literal(20_000), z.literal(30_000)]),
  fuelPreference: fuelSchema,
  chargingEnvironment: z.enum(["자택", "직장", "외부", "없음"]).optional(),
  residenceRegion: z.enum(["일반", "강원·산간", "제주"]),
  returnType: z.enum(["인수형", "반납형", "미정"]),
}).strict().superRefine((input, context) => {
  if (
    input.industryDetail !== undefined
    && !industryDetails[input.industry].has(input.industryDetail)
  ) {
    context.addIssue({ code: "custom", path: ["industryDetail"], message: "업종과 상세 선택이 일치하지 않습니다." });
  }
  const unique = new Set(input.preferences);
  if (unique.size !== input.preferences.length) {
    context.addIssue({ code: "custom", path: ["preferences"], message: "선호 조건은 중복될 수 없습니다." });
  }
  const explicit = [input.primaryPreference, input.situationPreference].filter((value) => value !== undefined);
  if (unique.size !== explicit.length || explicit.some((value) => !unique.has(value))) {
    context.addIssue({ code: "custom", path: ["preferences"], message: "명시적 선호 조건과 preferences가 일치해야 합니다." });
  }
  if (input.situationPreference === "가족" && input.childDetail === undefined) {
    context.addIssue({ code: "custom", path: ["childDetail"], message: "가족 조건에는 자녀 연령이 필요합니다." });
  }
  if (input.situationPreference !== "가족" && input.childDetail !== undefined) {
    context.addIssue({ code: "custom", path: ["childDetail"], message: "가족 조건에서만 사용할 수 있습니다." });
  }
  if (input.situationPreference === "화물" && input.cargoDetail === undefined) {
    context.addIssue({ code: "custom", path: ["cargoDetail"], message: "화물 조건에는 화물 종류가 필요합니다." });
  }
  if (input.situationPreference !== "화물" && input.cargoDetail !== undefined) {
    context.addIssue({ code: "custom", path: ["cargoDetail"], message: "화물 조건에서만 사용할 수 있습니다." });
  }
  if (input.fuelPreference === "전기차" && input.chargingEnvironment === undefined) {
    context.addIssue({ code: "custom", path: ["chargingEnvironment"], message: "전기차에는 충전 환경이 필요합니다." });
  }
  if (input.fuelPreference !== "전기차" && input.chargingEnvironment !== undefined) {
    context.addIssue({ code: "custom", path: ["chargingEnvironment"], message: "전기차에서만 사용할 수 있습니다." });
  }
}).transform((input) => ({
  ...input,
  preferences: [input.primaryPreference, input.situationPreference].filter((value) => value !== undefined),
}));

const step02V3RecommendRequestSchema = z.object({
  recommendationVersion: z.literal("step02-v3"),
  industry: industrySchema,
  industryDetail: z.string().min(1).optional(),
  budgetRange: z.enum(RECOMMEND_BUDGET_RANGE_IDS),
  preferences: z.array(step02V3PreferenceSchema).max(2),
  stylePreference: step02V3StyleSchema,
  situationPreference: situationSchema.optional(),
  childDetail: childSchema.optional(),
  cargoDetail: cargoSchema.optional(),
  annualMileage: z.union([z.literal(10_000), z.literal(20_000), z.literal(30_000)]),
  fuelPreference: fuelSchema,
  chargingEnvironment: z.enum(["자택", "직장", "외부", "없음"]).optional(),
  residenceRegion: z.enum(["일반", "강원·산간", "제주"]),
  returnType: z.enum(["인수형", "반납형", "미정"]),
}).strict().superRefine((input, context) => {
  if (
    input.industryDetail !== undefined
    && !industryDetails[input.industry].has(input.industryDetail)
  ) {
    context.addIssue({ code: "custom", path: ["industryDetail"], message: "업종과 상세 선택이 일치하지 않습니다." });
  }
  const expectedPreferences = [input.stylePreference, input.situationPreference]
    .filter((value): value is z.infer<typeof step02V3PreferenceSchema> => value !== undefined);
  if (
    input.preferences.length !== expectedPreferences.length
    || expectedPreferences.some((value) => !input.preferences.includes(value))
    || new Set(input.preferences).size !== input.preferences.length
  ) {
    context.addIssue({ code: "custom", path: ["preferences"], message: "STEP 02 선택값과 preferences가 일치해야 합니다." });
  }
  if (input.situationPreference === "가족" && input.childDetail === undefined) {
    context.addIssue({ code: "custom", path: ["childDetail"], message: "가족 조건에는 자녀 연령이 필요합니다." });
  }
  if (input.situationPreference !== "가족" && input.childDetail !== undefined) {
    context.addIssue({ code: "custom", path: ["childDetail"], message: "가족 조건에서만 사용할 수 있습니다." });
  }
  if (input.situationPreference === "화물" && input.cargoDetail === undefined) {
    context.addIssue({ code: "custom", path: ["cargoDetail"], message: "화물 조건에는 화물 종류가 필요합니다." });
  }
  if (input.situationPreference !== "화물" && input.cargoDetail !== undefined) {
    context.addIssue({ code: "custom", path: ["cargoDetail"], message: "화물 조건에서만 사용할 수 있습니다." });
  }
  if (input.fuelPreference === "전기차" && input.chargingEnvironment === undefined) {
    context.addIssue({ code: "custom", path: ["chargingEnvironment"], message: "전기차에는 충전 환경이 필요합니다." });
  }
  if (input.fuelPreference !== "전기차" && input.chargingEnvironment !== undefined) {
    context.addIssue({ code: "custom", path: ["chargingEnvironment"], message: "전기차에서만 사용할 수 있습니다." });
  }
}).transform((input) => ({
  ...input,
  ...getRecommendationBudgetBounds(input.budgetRange),
  preferences: [input.stylePreference, input.situationPreference]
    .filter((value): value is z.infer<typeof step02V3PreferenceSchema> => value !== undefined),
}));

type LegacyRecommendRequest = z.infer<typeof legacyRecommendRequestSchema>;
type Step02V3RecommendRequest = z.infer<typeof step02V3RecommendRequestSchema>;

export type RecommendRequest = LegacyRecommendRequest | Step02V3RecommendRequest;

// z.union은 양쪽 분기가 실패하면 최상위 invalid_union만 노출해 기존 API의
// 필드별 오류 계약을 잃는다. 버전 식별자로 먼저 분기한 뒤 해당 스키마의
// 세부 issue를 그대로 전달한다.
export const recommendRequestSchema: z.ZodType<RecommendRequest> = z.any().transform(
  (value, context): RecommendRequest => {
    const schema = value !== null
      && typeof value === "object"
      && "recommendationVersion" in value
      ? step02V3RecommendRequestSchema
      : legacyRecommendRequestSchema;
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) context.addIssue(issue);
      return z.NEVER;
    }
    return parsed.data;
  }
);
