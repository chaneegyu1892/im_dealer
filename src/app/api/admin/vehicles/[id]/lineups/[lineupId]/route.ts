import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lineupUpdateSchema } from "@/lib/validations/admin";

type Params = { params: Promise<{ id: string; lineupId: string }> };

// ─── PATCH /api/admin/vehicles/[id]/lineups/[lineupId] ──
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { lineupId } = await params;
    const body = await request.json();
    const parsed = lineupUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const lineup = await prisma.vehicleLineup.update({
      where: { id: lineupId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: lineup });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/lineups/[lineupId]]", error);
    return NextResponse.json({ error: "라인업 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─── DELETE /api/admin/vehicles/[id]/lineups/[lineupId] ─
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { lineupId } = await params;
    await prisma.vehicleLineup.delete({ where: { id: lineupId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/vehicles/[id]/lineups/[lineupId]]", error);
    return NextResponse.json({ error: "라인업 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
