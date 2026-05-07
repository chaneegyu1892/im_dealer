import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vehicles/:slug/colors
// 차량의 외장/내장 색상 목록 반환 (고객 견적 페이지용)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { slug, isVisible: true },
      select: {
        colors: {
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            kind: true,
            name: true,
            hexCode: true,
            imageUrl: true,
            priceDelta: true,
            isDefault: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "차량을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: vehicle.colors });
  } catch {
    return NextResponse.json(
      { success: false, error: "색상 정보를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
