import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recommend } from "@/lib/ai-recommender";
import { randomUUID } from "crypto";

const recommendSchema = z.object({
  industry: z.string().min(1),
  purpose: z.string().min(1),
  budgetMin: z.number().int().min(0),
  budgetMax: z.number().int().min(0),
  paymentStyle: z.enum(["보수형", "표준형", "공격형"]),
  annualMileage: z.number().int().min(0),
  returnType: z.enum(["인수형", "반납형", "미정"]),
  industryDetail: z.string().optional(),
  purposeDetail: z.string().optional(),
  budgetDetail: z.string().optional(),
  fuelPreference: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = recommendSchema.parse(body);

    const sessionId = randomUUID();

    // AI 추천 계산
    const vehicles = await recommend(input);

    // 추천 로그 저장 (AI 고도화용 데이터 축적)
    await prisma.recommendationLog.create({
      data: {
        sessionId,
        industry: input.industry,
        purpose: input.purpose,
        budgetMin: input.budgetMin,
        budgetMax: input.budgetMax,
        paymentStyle: input.paymentStyle,
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
