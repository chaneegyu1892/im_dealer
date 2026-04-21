import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, highlights, aiCaption } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing config ID" }, { status: 400 });
    }

    const updated = await prisma.recommendationConfig.update({
      where: { id },
      data: {
        highlights,
        aiCaption,
        updatedBy: session.email,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[AI_CONFIG_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
