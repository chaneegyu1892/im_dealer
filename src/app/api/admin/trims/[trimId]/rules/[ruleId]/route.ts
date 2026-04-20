import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ trimId: string; ruleId: string }> };

// ─── DELETE /api/admin/trims/[trimId]/rules/[ruleId] ────
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { ruleId } = await params;
    
    // Get the rule to check if it's a conflict rule
    const rule = await prisma.optionRule.findUnique({ where: { id: ruleId } });
    if (!rule) return NextResponse.json({ success: true });

    if (rule.ruleType === "CONFLICT") {
      // Find and delete the reverse rule if it exists
      await prisma.optionRule.deleteMany({
        where: {
          trimId: rule.trimId,
          ruleType: "CONFLICT",
          OR: [
            { sourceOptionId: rule.sourceOptionId, targetOptionId: rule.targetOptionId },
            { sourceOptionId: rule.targetOptionId, targetOptionId: rule.sourceOptionId },
          ],
        },
      });
    } else {
      await prisma.optionRule.delete({ where: { id: ruleId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/trims/[trimId]/rules/[ruleId]]", error);
    return NextResponse.json({ error: "규칙 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
