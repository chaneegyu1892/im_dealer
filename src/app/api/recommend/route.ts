import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recommend } from "@/lib/ai-recommender";
import { PREFERENCE_OPTIONS, MAX_PREFERENCES } from "@/constants/recommend-options";
import { randomUUID } from "crypto";

const PREFERENCE_VALUES = PREFERENCE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const SITUATION_VALUES = new Set<string>(
  PREFERENCE_OPTIONS.filter((o) => o.kind === "situation").map((o) => o.value)
);

const recommendSchema = z.object({
  industry: z.string().min(1),
  // 「원하는 차」 선호 특징 1~2개. 상황형(가족/화물)은 1개만 허용.
  preferences: z
    .array(z.enum(PREFERENCE_VALUES))
    .min(1)
    .max(MAX_PREFERENCES)
    .refine(
      (arr) => arr.filter((p) => SITUATION_VALUES.has(p)).length <= 1,
      { message: "상황형(가족/화물)은 하나만 선택할 수 있습니다." }
    ),
  childDetail: z.string().optional(),
  cargoDetail: z.string().optional(),
  annualMileage: z.number().int().min(0),
  returnType: z.enum(["인수형", "반납형", "미정"]),
  industryDetail: z.string().optional(),
  fuelPreference: z.string().optional(),
  chargingEnvironment: z.enum(["자택", "직장", "외부", "없음"]).optional(),
  residenceRegion: z.enum(["일반", "강원·산간", "제주"]).optional(),
  // 옛 세션 호환 — 새 추천 흐름에서는 사용 안 함. 받으면 DB 저장만.
  purpose: z.string().optional(),
  purposeDetail: z.string().optional(),
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
        // 신규 흐름은 preferences 기준. purpose(NOT NULL)는 하위호환용으로
        // 선택 value 들을 join 해 채운다(옛 세션이 보낸 purpose 가 있으면 그대로 보존).
        purpose: input.purpose ?? input.preferences.join(", "),
        preferences: input.preferences,
        childDetail: input.childDetail,
        cargoDetail: input.cargoDetail,
        budgetMin: input.budgetMin ?? 0,
        budgetMax: input.budgetMax ?? 0,
        paymentStyle: input.paymentStyle ?? "표준형",
        annualMileage: input.annualMileage,
        returnType: input.returnType,
        recommendedVehicleIds: vehicles.map((v) => v.vehicleId),
        recommendedReason: Object.fromEntries(
          vehicles.map((v) => [v.vehicleId, v.reason])
        ),
        // 결과 전체 freeze 스냅샷 — GET 이 재계산·LLM 없이 그대로 반환한다.
        result: vehicles as unknown as Prisma.InputJsonValue,
        industryDetail: input.industryDetail,
        purposeDetail: input.purposeDetail,
        budgetDetail: input.budgetDetail,
        fuelPreference: input.fuelPreference,
        chargingEnvironment: input.chargingEnvironment,
        residenceRegion: input.residenceRegion,
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
