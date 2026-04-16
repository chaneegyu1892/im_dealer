import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { vehicleCreateSchema, generateSlug } from "@/lib/validations/admin";
import { getAdminSession } from "@/lib/admin-auth";

// ─── GET /api/admin/vehicles ────────────────────────────
export async function GET(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const where = {
      ...(brand ? { brand } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { trims: true } } },
    });

    const data = vehicles.map((v) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      brand: v.brand,
      category: v.category,
      vehicleCode: v.vehicleCode,
      basePrice: v.basePrice,
      thumbnailUrl: v.thumbnailUrl,
      imageUrls: v.imageUrls,
      surchargeRate: v.surchargeRate,
      isVisible: v.isVisible,
      isPopular: v.isPopular,
      displayOrder: v.displayOrder,
      description: v.description,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      _count: v._count,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/vehicles]", error);
    return NextResponse.json(
      { error: "차량 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// ─── POST /api/admin/vehicles ───────────────────────────
export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const body = await request.json();
    const parsed = vehicleCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { slug: customSlug, ...data } = parsed.data;
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
      data: { ...data, slug },
    });

    return NextResponse.json({ success: true, data: vehicle }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/vehicles]", error);
    return NextResponse.json(
      { error: "차량 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
