import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lineupUpdateSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { isCarpan2TrimCurrentlySold } from "@/lib/vehicle-visibility-policy";

type Params = { params: Promise<{ id: string; lineupId: string }> };

// ─── PATCH /api/admin/vehicles/[id]/lineups/[lineupId] ──
export async function PATCH(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id, lineupId } = await params;
    const body = await request.json();
    const parsed = lineupUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.vehicleLineup.findFirst({
      where: { id: lineupId, vehicleId: id },
      include: {
        trims: {
          select: {
            id: true,
            externalId: true,
            isVisible: true,
            detailedSpecs: true,
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "라인업을 찾을 수 없습니다." }, { status: 404 });
    }

    const toShow: string[] = [];
    const toHide: string[] = [];
    let preservedVisibleTrims = 0;

    if (parsed.data.isVisible === true) {
      for (const trim of existing.trims) {
        const sold = trim.externalId
          ? isCarpan2TrimCurrentlySold(trim.detailedSpecs)
          : null;
        if (sold === true) {
          if (!trim.isVisible) toShow.push(trim.id);
        } else if (sold === false) {
          if (trim.isVisible) toHide.push(trim.id);
        } else if (trim.isVisible) {
          // 수동 생성 또는 원본 상태를 알 수 없는 트림은 운영 상태를 보존한다.
          preservedVisibleTrims++;
        }
      }

      const sellableTrimCount = existing.trims.filter((trim) => {
        const sold = trim.externalId
          ? isCarpan2TrimCurrentlySold(trim.detailedSpecs)
          : null;
        return sold === true || (sold === null && trim.isVisible);
      }).length;
      if (sellableTrimCount === 0) {
        return NextResponse.json(
          { error: "판매 중인 트림이 없어 라인업을 노출할 수 없습니다." },
          { status: 409 },
        );
      }
    }

    const lineup = await prisma.$transaction(async (tx) => {
      if (toShow.length > 0) {
        await tx.trim.updateMany({
          where: { id: { in: toShow }, lineupId, vehicleId: id },
          data: { isVisible: true },
        });
      }
      if (toHide.length > 0) {
        await tx.trim.updateMany({
          where: { id: { in: toHide }, lineupId, vehicleId: id },
          data: { isVisible: false },
        });
      }
      return tx.vehicleLineup.update({
        where: { id: lineupId },
        data: parsed.data,
      });
    });

    const before = Object.fromEntries(
      Object.entries(existing).filter(([key]) => key !== "trims"),
    );

    await logAdminAction({
      request,
      actor: session,
      action: "LINEUP_UPDATE",
      resource: "VehicleLineup",
      targetId: lineupId,
      before,
      after: lineup,
      meta: {
        trimsShown: toShow.length,
        trimsHidden: toHide.length,
        preservedVisibleTrims,
      },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: lineup });
  } catch (error) {
    console.error("[PATCH /api/admin/vehicles/[id]/lineups/[lineupId]]", error);
    return NextResponse.json({ error: "라인업 수정 중 오류가 발생했습니다." }, { status: 500 });
  }
}

// ─── DELETE /api/admin/vehicles/[id]/lineups/[lineupId] ─
export async function DELETE(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id, lineupId } = await params;
    const before = await prisma.vehicleLineup.findFirst({
      where: { id: lineupId, vehicleId: id },
    });
    if (!before) {
      return NextResponse.json({ error: "라인업을 찾을 수 없습니다." }, { status: 404 });
    }
    await prisma.vehicleLineup.delete({ where: { id: lineupId } });

    await logAdminAction({
      request,
      actor: session,
      action: "LINEUP_DELETE",
      resource: "VehicleLineup",
      targetId: lineupId,
      before,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/vehicles/[id]/lineups/[lineupId]]", error);
    return NextResponse.json({ error: "라인업 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
