import { generateReason } from "@/lib/llm-reason";
import type {
  RecommendInput,
  RecommendedVehicle,
  RecommendedVehicleDetail,
  RecommendScenarios,
} from "@/types/recommendation";

export interface LegacyScoredVehicle {
  readonly vehicleId: string;
  readonly modelKey: string;
  readonly modelYear: number;
  readonly score: number;
  readonly reason: string;
  readonly highlights: readonly string[];
  readonly detail: RecommendedVehicleDetail;
  readonly scenarios: RecommendScenarios;
  readonly estimatedMonthly: number;
}

export async function finalizeLegacyRecommendations(
  top: readonly LegacyScoredVehicle[],
  input: RecommendInput,
  preferenceLabel: string,
): Promise<RecommendedVehicle[]> {
  const llmReasons = await Promise.all(top.map((scored) => generateReason({
    industry: input.industry,
    purpose: preferenceLabel,
    budgetMax: 0,
    annualMileage: input.annualMileage,
    vehicleName: scored.detail.name,
    brand: scored.detail.brand,
    category: scored.detail.category,
    estimatedMonthly: scored.estimatedMonthly,
    fallback: scored.reason,
  })));

  return top.map((scored, index): RecommendedVehicle => ({
    vehicleId: scored.vehicleId,
    rank: index + 1,
    score: scored.score,
    reason: llmReasons[index],
    highlights: [...scored.highlights],
    estimatedMonthly: scored.estimatedMonthly,
    vehicle: scored.detail,
    scenarios: scored.scenarios,
  }));
}
