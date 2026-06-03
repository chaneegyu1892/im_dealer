import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recommend } from "@/lib/ai-recommender";
import { randomUUID } from "crypto";

const recommendSchema = z.object({
  industry: z.string().min(1),
  purpose: z.string().min(1),
  annualMileage: z.number().int().min(0),
  returnType: z.enum(["인수형", "반납형", "미정"]),
  industryDetail: z.string().optional(),
  purposeDetail: z.string().optional(),
  fuelPreference: z.string().optional(),
  chargingEnvironment: z.enum(["있음", "없음", "모르겠음"]).optional(),
  // 옛 세션 호환 — 새 추천 흐름에서는 사용 안 함. 받으면 DB 저장만.
  budgetMin: z.number().int().min(0).optional(),
  budgetMax: z.number().int().min(0).optional(),
  paymentStyle: z.enum(["보수형", "표준형", "공격형"]).optional(),
  budgetDetail: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = recommendSchema.parse(body);

    const sessionId = randomUUID();

    // AI 추천 계산
    const vehicles = await recommend(input);

    // 추천 로그 저장 (AI 고도화용 데이터 축적)
    // 새 흐름은 budget 계열을 받지 않으므로 DB NOT NULL 컬럼은 기본값(0/"표준형")으로 저장.
    // 옛 세션이 보낸 값이 있다면 그대로 보존.
    await prisma.recommendationLog.create({
      data: {
        sessionId,
        industry: input.industry,
        purpose: input.purpose,
        budgetMin: input.budgetMin ?? 0,
        budgetMax: input.budgetMax ?? 0,
        paymentStyle: input.paymentStyle ?? "표준형",
        annualMileage: input.annualMileage,
        returnType: input.returnType,
        recommendedVehicleIds: vehicles.map((v) => v.vehicleId),
        recommendedReason: Object.fromEntries(
          vehicles.map((v) => [v.vehicleId, v.reason])
        ),
        industryDetail: input.industryDetail,
        purposeDetail: input.purposeDetail,
        budgetDetail: input.budgetDetail,
        fuelPreference: input.fuelPreference,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({ sessionId, vehicles });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
