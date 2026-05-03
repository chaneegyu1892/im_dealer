import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { popularConfigCreateSchema } from "@/lib/validations/admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/admin/vehicles/[id]/popular-configs ───────
export async function GET(request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const configs = await prisma.popularConfig.findMany({
      where: { vehicleId: id },
      include: { items: { orderBy: { displayOrder: "asc" } } },
      orderBy: { displayOrder: "asc" },
    });
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    console.error("[GET /api/admin/vehicles/[id]/popular-configs]", error);
    return NextResponse.json(
      { error: "추천 구성 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/vehicles/[id]/popular-configs ──────
export async function POST(request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = popularConfigCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { items, ...configData } = parsed.data;

    const config = await prisma.popularConfig.create({
      data: {
        ...configData,
        vehicleId: id,
        items: {
          create: items.map((item) => ({
            name: item.name,
            price: item.price,
            trimOptionId: item.trimOptionId ?? null,
            displayOrder: item.displayOrder,
          })),
        },
      },
      include: { items: { orderBy: { displayOrder: "asc" } } },
    });

    await logAdminAction({
      request,
      actor: admin,
      action: "POPULAR_CONFIG_CREATE",
      resource: "PopularConfig",
      targetId: config.id,
      after: config,
      meta: { vehicleId: id },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: config }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/vehicles/[id]/popular-configs]", error);
    return NextResponse.json(
      { error: "추천 구성 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
