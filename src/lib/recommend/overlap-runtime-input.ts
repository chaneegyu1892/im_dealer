import { z } from "zod";
import type { OverlapScoringInput } from "./overlap-scoring";

const common = z.object({
  industry: z.enum(["법인", "개인사업자", "개인"]),
  industryDetail: z.string().min(1).optional(),
  budgetMax: z.number().int().nonnegative().optional(),
  primaryPreference: z.enum(["안정감", "주차편의", "경제성", "고급"]).optional(),
  annualMileage: z.union([z.literal(10_000), z.literal(20_000), z.literal(30_000)]),
  residenceRegion: z.enum(["일반", "강원·산간", "제주"]),
}).passthrough();

const additional = z.union([
  z.object({
    situationPreference: z.literal("가족"),
    childDetail: z.enum(["영유아", "미취학", "초등", "중학생+"]),
    cargoDetail: z.never().optional(),
  }).passthrough(),
  z.object({
    situationPreference: z.literal("화물"),
    cargoDetail: z.enum(["소형 박스", "대형 화물"]),
    childDetail: z.never().optional(),
  }).passthrough(),
  z.object({
    situationPreference: z.undefined().optional(),
    childDetail: z.never().optional(),
    cargoDetail: z.never().optional(),
  }).passthrough(),
]);

const fuel = z.union([
  z.object({
    fuelPreference: z.literal("전기차"),
    chargingEnvironment: z.enum(["자택", "직장", "외부", "없음"]),
  }).passthrough(),
  z.object({
    fuelPreference: z.enum(["상관없음", "가솔린/디젤", "하이브리드"]),
    chargingEnvironment: z.never().optional(),
  }).passthrough(),
]);

const overlapRuntimeInputSchema = common.and(additional).and(fuel);

export function parseOverlapRuntimeInput(value: unknown): OverlapScoringInput {
  return overlapRuntimeInputSchema.parse(value);
}
