import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleOptionBadgeSetSchema } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import {
  normalizeOptionName,
  summarizeVehicleOptions,
} from "@/lib/vehicle-option-badges";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/admin/vehicles/[id]/option-badges ─────────
// 차량 전체 트림의 옵션명을 중복 제거해 나열하고, 옵션명별 현재 배지를 함께 반환한다.
// (요청 명세: "차량의 모든 옵션을 나열함 → 그 옵션에 배지 작업")
export async function GET(_request: NextRequest, { params }: Params) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: {
        id: true,
        trims: {
          select: {
            options: {
              select: { name: true, category: true, isAccessory: true },
            },
          },
        },
        optionBadges: { select: { optionName: true, badgeId: true } },
      },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    const badgeIdByName = new Map(
      vehicle.optionBadges.map((m) => [normalizeOptionName(m.optionName), m.badgeId])
    );
    const options = summarizeVehicleOptions(vehicle.trims).map((option) => ({
      ...option,
      badgeId: badgeIdByName.get(option.name) ?? null,
    }));

    return NextResponse.json({ success: true, data: options });
  } catch (error) {
    console.error("[GET /api/admin/vehicles/[id]/option-badges]", error);
    return NextResponse.json(
      { error: "옵션 배지 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── PUT /api/admin/vehicles/[id]/option-badges ─────────
// 옵션명 하나의 배지를 지정/해제한다. badgeId: null 이면 해제.
export async function PUT(request: NextRequest, { params }: Params) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = vehicleOptionBadgeSetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id }, select: { id: true } });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    const optionName = normalizeOptionName(parsed.data.optionName);
    const { badgeId } = parsed.data;

    if (badgeId) {
      const badge = await prisma.optionBadge.findUnique({ where: { id: badgeId } });
      if (!badge) {
        return NextResponse.json({ error: "배지를 찾을 수 없습니다." }, { status: 404 });
      }
      await prisma.vehicleOptionBadge.upsert({
        where: { vehicleId_optionName: { vehicleId: id, optionName } },
        create: { vehicleId: id, optionName, badgeId },
        update: { badgeId },
      });
    } else {
      await prisma.vehicleOptionBadge.deleteMany({
        where: { vehicleId: id, optionName },
      });
    }

    await logAdminAction({
      request,
      actor: session,
      action: badgeId ? "VEHICLE_OPTION_BADGE_SET" : "VEHICLE_OPTION_BADGE_UNSET",
      resource: "VehicleOptionBadge",
      targetId: id,
      meta: { optionName, badgeId },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/admin/vehicles/[id]/option-badges]", error);
    return NextResponse.json(
      { error: "옵션 배지 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
