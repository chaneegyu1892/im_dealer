import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ruleCreateSchema } from "@/lib/validations/admin";

type Params = { params: Promise<{ trimId: string }> };

// ─── GET /api/admin/trims/[trimId]/rules ────────────────
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { trimId } = await params;
    const rules = await prisma.optionRule.findMany({
      where: { trimId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: rules });
  } catch (error) {
    console.error("[GET /api/admin/trims/[trimId]/rules]", error);
    return NextResponse.json({ error: "규칙 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─── POST /api/admin/trims/[trimId]/rules ───────────────
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { trimId } = await params;
    const body = await request.json();
    const parsed = ruleCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ruleType, sourceOptionId, targetOptionId } = parsed.data;

    if (sourceOptionId === targetOptionId) {
      return NextResponse.json({ error: "동일한 옵션 간에는 규칙을 설정할 수 없습니다." }, { status: 400 });
    }

    // Check for existing rule
    const existing = await prisma.optionRule.findFirst({
      where: {
        trimId,
        sourceOptionId,
        targetOptionId,
        ruleType,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "이미 존재하는 규칙입니다." }, { status: 400 });
    }

    // Create the rule
    const rule = await prisma.optionRule.create({
      data: {
        trimId,
        ruleType,
        sourceOptionId,
        targetOptionId,
      },
    });

    // If CONFLICT, create the reverse rule
    if (ruleType === "CONFLICT") {
      const reverseExisting = await prisma.optionRule.findFirst({
        where: {
          trimId,
          sourceOptionId: targetOptionId,
          targetOptionId: sourceOptionId,
          ruleType: "CONFLICT",
        },
      });

      if (!reverseExisting) {
        await prisma.optionRule.create({
          data: {
            trimId,
            ruleType: "CONFLICT",
            sourceOptionId: targetOptionId,
            targetOptionId: sourceOptionId,
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/trims/[trimId]/rules]", error);
    return NextResponse.json({ error: "규칙 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
