import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vehicles/:slug/popular-configs
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { slug, isVisible: true },
      select: { id: true },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const configs = await prisma.popularConfig.findMany({
      where: { vehicleId: vehicle.id, isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        items: {
          orderBy: { displayOrder: "asc" },
          select: { id: true, name: true, price: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: configs });
  } catch {
    return NextResponse.json(
      { success: false, error: "추천 구성 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
