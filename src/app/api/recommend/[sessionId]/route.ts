import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { recommend } from "@/lib/ai-recommender";
import { parseStoredResult } from "@/lib/recommend-result";
import { lockRecommendScenario } from "@/lib/member-gate";
import type { RecommendedVehicle, RecommendResultResponse } from "@/types/recommendation";

/**
 * 비회원에게는 각 차량의 보증금형(conservative)·선납형(aggressive) 시나리오를 잠근다.
 * 낮아진 월납입금이 응답 JSON 에 실리지 않게 해 보안 경계를 만든다(standard 는 유지).
 * freeze 스냅샷은 그대로 두고 응답 직전에만 변형한다 — 원본 미변형(immutable).
 */
function gateVehiclesForMember(
  vehicles: RecommendedVehicle[],
  isMember: boolean
): RecommendedVehicle[] {
  if (isMember) return vehicles;
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

    const input = {
      industry: log.industry,
      purpose: log.purpose,
      preferences: log.preferences ?? undefined,
      budgetMin: log.budgetMin,
      budgetMax: log.budgetMax,
      paymentStyle: log.paymentStyle as "보수형" | "표준형" | "공격형",
      annualMileage: log.annualMileage,
      returnType: log.returnType as "인수형" | "반납형" | "미정",
    };

    // ── freeze 경로 ─────────────────────────────────────────────
    // 저장된 결과가 있으면 재계산·LLM 없이 그대로 반환한다.
    // 같은 sessionId 는 항상 동일한 결과 → 새로고침/뒤로에도 안 흔들림.
    const frozen = parseStoredResult(log.result);
    if (frozen) {
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
    const vehicles = await recommend({
      industry: log.industry,
      preferences: log.preferences ?? [],
      childDetail: log.childDetail ?? undefined,
      cargoDetail: log.cargoDetail ?? undefined,
      purpose: log.purpose,
      budgetMin: log.budgetMin,
      budgetMax: log.budgetMax,
      paymentStyle: log.paymentStyle as "보수형" | "표준형" | "공격형",
      annualMileage: log.annualMileage,
      returnType: log.returnType as "인수형" | "반납형" | "미정",
      industryDetail: log.industryDetail ?? undefined,
      purposeDetail: log.purposeDetail ?? undefined,
      budgetDetail: log.budgetDetail ?? undefined,
      fuelPreference: log.fuelPreference ?? undefined,
    });

    const storedReasons = log.recommendedReason as Record<string, string> | null;
    const vehiclesWithReasons = storedReasons
      ? vehicles.map((v) => ({ ...v, reason: storedReasons[v.vehicleId] ?? v.reason }))
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
