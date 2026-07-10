import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recommend } from "@/lib/ai-recommender";
import { PREFERENCE_OPTIONS, MAX_PREFERENCES } from "@/constants/recommend-options";
import { randomUUID } from "crypto";
import { strictRateLimit, checkRateLimit } from "@/lib/rate-limit";

const PREFERENCE_VALUES = PREFERENCE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const FEEL_VALUES = PREFERENCE_OPTIONS.filter((o) => o.kind === "feel").map((o) => o.value) as [string, ...string[]];
const SITUATION_VALUES = new Set<string>(
  PREFERENCE_OPTIONS.filter((o) => o.kind === "situation").map((o) => o.value)
);
const SITUATION_ENUM_VALUES = [...SITUATION_VALUES] as [string, ...string[]];

const recommendSchema = z
  .object({
    industry: z.string().min(1),
    preferences: z
      .array(z.enum(PREFERENCE_VALUES))
      .max(MAX_PREFERENCES)
      .refine(
        (arr) => arr.filter((p) => FEEL_VALUES.includes(p)).length <= 1,
        { message: "차종 기준은 하나만 선택할 수 있습니다." }
      )
      .refine(
        (arr) => arr.filter((p) => SITUATION_VALUES.has(p)).length <= 1,
        { message: "심화 조건은 하나만 선택할 수 있습니다." }
      ),
    primaryPreference: z.enum(FEEL_VALUES).optional(),
    situationPreference: z.enum(SITUATION_ENUM_VALUES).optional(),
    childDetail: z.string().optional(),
    cargoDetail: z.string().optional(),
    annualMileage: z.number().int().min(0),
    returnType: z.enum(["인수형", "반납형", "미정"]),
    industryDetail: z.string().optional(),
    fuelPreference: z.string().optional(),
    chargingEnvironment: z.enum(["자택", "직장", "외부", "없음"]).optional(),
    residenceRegion: z.enum(["일반", "강원·산간", "제주"]).optional(),
    purpose: z.string().optional(),
    purposeDetail: z.string().optional(),
    budgetMin: z.number().int().min(0).optional(),
    budgetMax: z.number().int().min(0).optional(),
    paymentStyle: z.enum(["보수형", "표준형", "공격형"]).optional(),
    budgetDetail: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    const selected = new Set(input.preferences);
    if (input.primaryPreference && !selected.has(input.primaryPreference)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryPreference"],
        message: "차종 기준 선택값이 preferences와 일치하지 않습니다.",
      });
    }
    if (input.situationPreference && !selected.has(input.situationPreference)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["situationPreference"],
        message: "심화 조건 선택값이 preferences와 일치하지 않습니다.",
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const limited = await checkRateLimit(request, strictRateLimit);
    if (limited) return limited;

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
        purpose: input.purpose ?? (input.preferences.length > 0 ? input.preferences.join(", ") : "해당 없음"),
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
