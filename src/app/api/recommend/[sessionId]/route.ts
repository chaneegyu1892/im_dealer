import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { recommendLegacyV1 } from "@/lib/ai-recommender";
import { parseStoredResultState } from "@/lib/recommend-result";
import { lockRecommendScenario } from "@/lib/member-gate";
import type {
  PaymentStyle,
  RecommendedVehicle,
  RecommendResultResponse,
  ReturnType,
} from "@/types/recommendation";

const storedReasonsSchema = z.record(z.string());
const primaryPreferences = new Set(["안정감", "주차편의", "경제성", "고급"]);
const situationPreferences = new Set(["가족", "화물"]);

function paymentStyle(value: string): PaymentStyle {
  return value === "보수형" || value === "공격형" ? value : "표준형";
}

function returnType(value: string): ReturnType {
  return value === "인수형" || value === "반납형" ? value : "미정";
}

function chargingEnvironment(value: string | null): "자택" | "직장" | "외부" | "없음" | undefined {
  return value === "자택" || value === "직장" || value === "외부" || value === "없음" ? value : undefined;
}

function residenceRegion(value: string | null): "일반" | "강원·산간" | "제주" | undefined {
  return value === "일반" || value === "강원·산간" || value === "제주" ? value : undefined;
}

/**
 * 비회원에게는 각 차량의 보증금형(conservative)·선납형(aggressive) 시나리오를 잠근다.
 * 낮아진 월납입금이 응답 JSON 에 실리지 않게 해 보안 경계를 만든다(standard 는 유지).
 * freeze 스냅샷은 그대로 두고 응답 직전에만 변형한다 — 원본 미변형(immutable).
 */
function gateVehiclesForMember(
  vehicles: readonly RecommendedVehicle[],
  isMember: boolean
): RecommendedVehicle[] {
  if (isMember) return [...vehicles];
  return vehicles.map((v) => ({
    ...v,
    scenarios: {
      ...v.scenarios,
      conservative: lockRecommendScenario(v.scenarios.conservative),
      aggressive: lockRecommendScenario(v.scenarios.aggressive),
    },
  }));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // 회원 여부 — 보증금형·선납형(낮아진 월납입금)은 회원 전용. 응답 직전에 게이팅.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const isMember = !!user;

    // 추천 로그 조회 (입력값 + freeze 스냅샷 복원)
    const log = await prisma.recommendationLog.findFirst({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
    });

    if (!log) {
      return NextResponse.json(
        { error: "추천 결과를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const preferences = log.preferences ?? [];
    const primaryPreference = preferences.find((value) => primaryPreferences.has(value));
    const situationPreference = preferences.find((value) => situationPreferences.has(value));
    const input: RecommendResultResponse["input"] = {
      industry: log.industry,
      purpose: log.purpose,
      preferences,
      industryDetail: log.industryDetail ?? undefined,
      primaryPreference,
      situationPreference,
      childDetail: log.childDetail ?? undefined,
      cargoDetail: log.cargoDetail ?? undefined,
      budgetMin: log.budgetMin,
      budgetMax: log.budgetMax,
      paymentStyle: paymentStyle(log.paymentStyle),
      annualMileage: log.annualMileage,
      returnType: returnType(log.returnType),
      fuelPreference: log.fuelPreference ?? undefined,
      chargingEnvironment: chargingEnvironment(log.chargingEnvironment),
      residenceRegion: residenceRegion(log.residenceRegion),
    };

    // ── freeze 경로 ─────────────────────────────────────────────
    // 저장된 결과가 있으면 재계산·LLM 없이 그대로 반환한다.
    // 같은 sessionId 는 항상 동일한 결과 → 새로고침/뒤로에도 안 흔들림.
    const stored = parseStoredResultState(log.result);
    if (stored.kind === "invalid") {
      return NextResponse.json(
        { error: "저장된 추천 결과 형식이 올바르지 않습니다." },
        { status: 500 }
      );
    }
    if (stored.kind === "legacy" || stored.kind === "v2") {
      const frozen = stored.vehicles;
      // 추천 이후 삭제/비노출된 차량만 걸러낸다 (견적 링크 깨짐 방지).
      // 가격·이유 등 나머지는 스냅샷 그대로 유지(freeze).
      const visibleIds = frozen.length
        ? new Set(
            (
              await prisma.vehicle.findMany({
                where: { id: { in: frozen.map((v) => v.vehicleId) }, isVisible: true },
                select: { id: true },
              })
            ).map((v) => v.id)
          )
        : new Set<string>();

      const response: RecommendResultResponse = {
        sessionId,
        input,
        vehicles: gateVehiclesForMember(
          frozen.filter((v) => visibleIds.has(v.vehicleId)),
          isMember
        ),
      };
      return NextResponse.json(response);
    }

    // ── 폴백 (옛 로그: result 스냅샷 없음) ───────────────────────
    // 최신 데이터 기준으로 재계산하되, LLM 이유는 저장된 값 재사용.
    const vehicles = await recommendLegacyV1({
      industry: log.industry,
      preferences,
      primaryPreference,
      situationPreference,
      childDetail: log.childDetail ?? undefined,
      cargoDetail: log.cargoDetail ?? undefined,
      purpose: log.purpose,
      budgetMin: log.budgetMin,
      budgetMax: log.budgetMax,
      paymentStyle: paymentStyle(log.paymentStyle),
      annualMileage: log.annualMileage,
      returnType: returnType(log.returnType),
      industryDetail: log.industryDetail ?? undefined,
      purposeDetail: log.purposeDetail ?? undefined,
      budgetDetail: log.budgetDetail ?? undefined,
      fuelPreference: log.fuelPreference ?? undefined,
      chargingEnvironment: chargingEnvironment(log.chargingEnvironment),
      residenceRegion: residenceRegion(log.residenceRegion),
    });

    const storedReasons = storedReasonsSchema.safeParse(log.recommendedReason);
    const vehiclesWithReasons = storedReasons.success
      ? vehicles.map((v) => ({ ...v, reason: storedReasons.data[v.vehicleId] ?? v.reason }))
      : vehicles;

    const response: RecommendResultResponse = {
      sessionId,
      input,
      vehicles: gateVehiclesForMember(vehiclesWithReasons, isMember),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[GET /api/recommend/:sessionId]", error);
    return NextResponse.json(
      { error: "추천 결과 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
