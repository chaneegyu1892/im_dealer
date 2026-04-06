import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recommend } from "@/lib/ai-recommender";
import type { RecommendResultResponse } from "@/types/recommendation";

export async function GET(
  _request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;

    // 추천 로그에서 입력값 복원
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

    // 입력값으로 추천 재계산 (최신 데이터 기준)
    const vehicles = await recommend({
      industry: log.industry,
      purpose: log.purpose,
      budgetMin: log.budgetMin,
      budgetMax: log.budgetMax,
      paymentStyle: log.paymentStyle as "보수형" | "표준형" | "공격형",
      annualMileage: log.annualMileage,
      returnType: log.returnType as "인수형" | "반납형" | "미정",
    });

    const response: RecommendResultResponse = {
      sessionId,
      input: {
        industry: log.industry,
        purpose: log.purpose,
        budgetMin: log.budgetMin,
        budgetMax: log.budgetMax,
        paymentStyle: log.paymentStyle as "보수형" | "표준형" | "공격형",
        annualMileage: log.annualMileage,
        returnType: log.returnType as "인수형" | "반납형" | "미정",
      },
      vehicles,
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
