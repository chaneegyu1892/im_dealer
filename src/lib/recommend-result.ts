import { z } from "zod";
import type { RecommendedVehicle } from "@/types/recommendation";

/**
 * 저장된(freeze) 추천 결과 JSON 검증.
 *
 * POST /api/recommend 가 계산 결과(RecommendedVehicle[])를 RecommendationLog.result 에
 * 그대로 저장하고, GET 이 이를 재계산 없이 그대로 돌려준다. 우리가 직접 쓴 값이지만
 * - 옛 로그(result = null)
 * - 옛 스키마/손상 데이터
 * 를 안전하게 걸러야 하므로, 최소 형태만 검증하고 어긋나면 null 을 돌려준다.
 * (null → 호출부가 기존 재계산 경로로 폴백)
 */
const storedVehicleSchema = z
  .object({
    vehicleId: z.string().min(1),
    rank: z.number(),
    reason: z.string(),
    vehicle: z.object({ slug: z.string().min(1) }).passthrough(),
    scenarios: z.object({}).passthrough(),
  })
  .passthrough();

const storedResultSchema = z.array(storedVehicleSchema);

/**
 * @returns 유효한 frozen 결과면 RecommendedVehicle[] (빈 배열 포함), 아니면 null.
 *          null 은 "저장본 없음/무효 → 재계산 폴백" 신호다.
 */
export function parseStoredResult(value: unknown): RecommendedVehicle[] | null {
  if (value === null || value === undefined) return null;
  const parsed = storedResultSchema.safeParse(value);
  if (!parsed.success) return null;
  return parsed.data as unknown as RecommendedVehicle[];
}
