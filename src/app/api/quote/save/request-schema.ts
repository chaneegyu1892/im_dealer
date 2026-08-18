import { z } from "zod";

/** 옵션 추가금 상한(원) — 회원이 극단값으로 차량가/회수율 밴드를 왜곡하는 것 방지. */
export const EXTRA_OPTIONS_PRICE_MAX = 50_000_000;

export const saveQuoteSchema = z.object({
  // 클라이언트 임의 값 — 플로딩·DB 부피 공격 방지를 위한 길이 상한
  sessionId: z.string().min(1).max(64),
  vehicleSlug: z.string().min(1),
  trimId: z.string().min(1),
  selectedOptionIds: z.array(z.string()).default([]),
  extraOptionsPrice: z.number().int().min(0).max(EXTRA_OPTIONS_PRICE_MAX).default(0),
  contractMonths: z.number().int().refine((value) => [36, 48, 60].includes(value)),
  annualMileage: z.number().int().refine((value) => [10000, 20000, 30000].includes(value)),
  contractType: z.enum(["인수형", "반납형"]),
  customerType: z.enum(["individual", "self_employed", "corporate", "nonprofit"]).default("individual"),
  productType: z.enum(["장기렌트", "리스"]).default("장기렌트"),
  scenarioType: z.enum(["conservative", "standard", "aggressive"]),
  customDepositRate: z.number().min(0).max(30).optional(),
  customPrepayRate: z.number().min(0).max(30).optional(),
  exteriorColorId: z.string().nullable().optional(),
  interiorColorId: z.string().nullable().optional(),
  quoteType: z.enum(["AI", "DETAIL"]).default("DETAIL"),
}).refine(
  (input) => (input.customDepositRate ?? 0) === 0 || (input.customPrepayRate ?? 0) === 0,
  { message: "보증금과 선납금은 동시에 적용할 수 없습니다." }
);
