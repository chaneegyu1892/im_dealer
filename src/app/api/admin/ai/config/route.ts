import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { aiConfigUpdateSchema } from "@/lib/validations/admin";

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = aiConfigUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, highlights, aiCaption, scoreMatrix } = parsed.data;

    const existing = await prisma.recommendationConfig.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "구성을 찾을 수 없습니다." }, { status: 404 });
    }

    const updated = await prisma.recommendationConfig.update({
      where: { id },
      data: {
        ...(highlights !== undefined && { highlights }),
        ...(aiCaption !== undefined && { aiCaption }),
        ...(scoreMatrix !== undefined && { scoreMatrix }),
        updatedBy: session.email,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[AI_CONFIG_POST]", error);
    Sentry.captureException(error, { tags: { route: "admin/ai/config" } });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
