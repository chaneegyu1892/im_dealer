import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vehicles/:slug/trims
// 차량의 전체 트림 + 옵션 목록 반환
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { slug, isVisible: true },
      select: { id: true, name: true },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const trims = await prisma.trim.findMany({
      where: { vehicleId: vehicle.id, isVisible: true },
      orderBy: [{ isDefault: "desc" }, { price: "asc" }],
      include: {
        options: {
          orderBy: [{ isAccessory: "asc" }, { price: "asc" }],
          select: {
            id: true,
            name: true,
            price: true,
            category: true,
            description: true,
            isAccessory: true,
            isDefault: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: trims.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
        engineType: t.engineType,
        fuelEfficiency: t.fuelEfficiency,
        isDefault: t.isDefault,
        specs: t.specs,
        options: t.options,
      })),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "트림 정보를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
