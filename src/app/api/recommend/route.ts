import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { recommendForVersion } from "@/lib/ai-recommender";
import { toPrismaJson } from "@/lib/prisma-json";
import { getRecommendEngineVersion } from "@/lib/recommend/recommend-engine-version";
import { recommendRequestSchema } from "@/lib/recommend/recommend-request";
import { randomUUID } from "crypto";
import { strictRateLimit, checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const limited = await checkRateLimit(request, strictRateLimit);
    if (limited) return limited;

    const body = await request.json();
    const input = recommendRequestSchema.parse(body);

    const sessionId = randomUUID();

    // AI 추천 계산
    const engineVersion = "recommendationVersion" in input
      ? input.recommendationVersion
      : getRecommendEngineVersion();
    const vehicles = await recommendForVersion(input, engineVersion);
    const storedResult = engineVersion === "legacy-v1"
      ? vehicles
      : { version: engineVersion, vehicles };

    // 추천 로그 저장 (AI 고도화용 데이터 축적)
    await prisma.recommendationLog.create({
      data: {
        sessionId,
        industry: input.industry,
        // 신규 흐름은 preferences 기준. purpose(NOT NULL)는 하위호환용으로
        // 선택 value 들을 join 해 채운다(옛 세션이 보낸 purpose 가 있으면 그대로 보존).
        purpose: input.preferences.length > 0 ? input.preferences.join(", ") : "해당 없음",
        preferences: input.preferences,
        childDetail: input.childDetail,
        cargoDetail: input.cargoDetail,
        budgetMin: "recommendationVersion" in input ? input.budgetMin : 0,
        budgetMax: input.budgetMax ?? 0,
        paymentStyle: "표준형",
        annualMileage: input.annualMileage,
        returnType: input.returnType,
        recommendedVehicleIds: vehicles.map((v) => v.vehicleId),
        recommendedReason: Object.fromEntries(
          vehicles.map((v) => [v.vehicleId, v.reason])
        ),
        // 결과 전체 freeze 스냅샷 — GET 이 재계산·LLM 없이 그대로 반환한다.
        result: toPrismaJson(storedResult),
        industryDetail: input.industryDetail,
        fuelPreference: input.fuelPreference,
        chargingEnvironment: input.chargingEnvironment,
        residenceRegion: input.residenceRegion,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({ sessionId, vehicles });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[POST /api/recommend]", error);
    return NextResponse.json(
      { error: "추천 요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
