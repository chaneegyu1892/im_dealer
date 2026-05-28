import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { invalidateRecommendFlowConfigCache, DEFAULT_FLOW_CONFIG } from "@/lib/recommend-config";

export async function GET() {
  try {
    const row = await (prisma as any).recommendFlowConfig.findUnique({
      where: { id: "singleton" },
    });
    return NextResponse.json({
      success: true,
      data: row ?? { ...DEFAULT_FLOW_CONFIG, id: "singleton" },
    });
  } catch (error) {
    console.error("[GET /api/admin/ai/flow-config]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const body = await req.json();
    const { questions, scoring } = body as { questions?: unknown; scoring?: unknown };

    if (!questions && !scoring) {
      return NextResponse.json({ error: "questions 또는 scoring 중 하나는 필요합니다." }, { status: 400 });
    }

    const existing = await (prisma as any).recommendFlowConfig.findUnique({
      where: { id: "singleton" },
    });

    const updated = await (prisma as any).recommendFlowConfig.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        questions: questions ?? DEFAULT_FLOW_CONFIG.questions,
        scoring: scoring ?? DEFAULT_FLOW_CONFIG.scoring,
        updatedBy: session.email,
      },
      update: {
        ...(questions !== undefined && { questions }),
        ...(scoring !== undefined && { scoring }),
        updatedBy: session.email,
      },
    });

    invalidateRecommendFlowConfigCache();

    await logAdminAction({
      request: req,
      actor: session,
      action: "AI_FLOW_CONFIG_UPDATE",
      resource: "RecommendFlowConfig",
      targetId: "singleton",
      before: existing,
      after: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/ai/flow-config]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
