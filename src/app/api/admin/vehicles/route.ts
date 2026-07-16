import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleCreateSchema, generateSlug } from "@/lib/validations/admin";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import type { Prisma } from "@prisma/client";

type VehicleListRow = Prisma.VehicleGetPayload<{
  include: { _count: { select: { trims: true } } };
}>;

function serializeVehicleListRow(vehicle: VehicleListRow) {
  return {
    id: vehicle.id,
    slug: vehicle.slug,
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category,
    vehicleCode: vehicle.vehicleCode,
    basePrice: vehicle.basePrice,
    thumbnailUrl: vehicle.thumbnailUrl,
    imageUrls: vehicle.imageUrls,
    surchargeRate: vehicle.surchargeRate,
    isVisible: vehicle.isVisible,
    isPopular: vehicle.isPopular,
    isSpotlight: vehicle.isSpotlight,
    displayOrder: vehicle.displayOrder,
    description: vehicle.description,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    _count: vehicle._count,
  };
}

// ─── GET /api/admin/vehicles ────────────────────────────
export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const includeTrims = searchParams.get("includeTrims") === "true";
    const where = {
      ...(brand ? { brand } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [
      { displayOrder: "asc" },
      { createdAt: "desc" },
    ];
    const data = includeTrims
      ? (
          await prisma.vehicle.findMany({
            where,
            orderBy,
            include: {
              _count: { select: { trims: true } },
              trims: { orderBy: { price: "asc" } },
              lineups: true,
            },
          })
        ).map((vehicle) => ({
          ...serializeVehicleListRow(vehicle),
          trims: vehicle.trims,
          lineups: vehicle.lineups,
        }))
      : (
          await prisma.vehicle.findMany({
            where,
            orderBy,
            include: { _count: { select: { trims: true } } },
          })
        ).map(serializeVehicleListRow);

    return NextResponse.json({ success: true, data });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary converts unexpected failures to 500.
    console.error("[GET /api/admin/vehicles]", error);
    return NextResponse.json(
      { error: "차량 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/vehicles ───────────────────────────
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("staff");
  if (error) return error;
  try {
    const body = await request.json();
    const parsed = vehicleCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { slug: customSlug, scraperRefs, ...data } = parsed.data;
    const slug = customSlug ?? generateSlug(data.brand, data.name);

    // slug 중복 확인
    const existing = await prisma.vehicle.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "이미 동일한 슬러그가 존재합니다." },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ...data,
        ...(scraperRefs ? { scraperRefs } : {}),
        slug,
        thumbnailUrl: "",
        imageUrls: [],
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "VEHICLE_CREATE",
      resource: "Vehicle",
      targetId: vehicle.id,
      after: vehicle,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) { // no-excuse-ok: catch -- HTTP boundary converts unexpected failures to 500.
    console.error("[POST /api/admin/vehicles]", error);
    return NextResponse.json(
      { error: "차량 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
