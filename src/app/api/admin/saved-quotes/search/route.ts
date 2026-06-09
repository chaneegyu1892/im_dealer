import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { maskPhone, formatReviewDate } from "@/lib/review-utils";
import type { CustomerSearchResult } from "@/types/review";

function quoteStatusLabel(status: string): string {
  switch (status) {
    case "NEW": return "견적 신청";
    case "CONTACTED": return "상담 진행";
    case "IN_PROGRESS": return "진행 중";
    case "CONVERTED": return "계약 완료";
    case "LOST": return "이탈";
    default: return status;
  }
}

export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 1 || q.length > 30) {
      return NextResponse.json({ success: true, data: [] });
    }

    const rows = await prisma.savedQuote.findMany({
      where: {
        deletedAt: null,
        customerName: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        customerName: true,
        phone: true,
        customerType: true,
        vehicleId: true,
        createdAt: true,
        status: true,
      },
    });

    const vehicleIds = Array.from(
      new Set(rows.map((r) => r.vehicleId).filter((id): id is string => Boolean(id)))
    );
    const vehicles = vehicleIds.length
      ? await prisma.vehicle.findMany({
          where: { id: { in: vehicleIds } },
          select: { id: true, name: true, brand: true },
        })
      : [];
    const vMap = new Map(vehicles.map((v) => [v.id, `${v.brand} ${v.name}`]));

    const data: CustomerSearchResult[] = rows.map((r) => ({
      savedQuoteId: r.id,
      customerName: r.customerName ?? "(이름 없음)",
      phoneMasked: maskPhone(r.phone),
      customerType: r.customerType,
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleId ? vMap.get(r.vehicleId) ?? null : null,
      createdAt: formatReviewDate(r.createdAt),
      status: r.status,
      statusLabel: quoteStatusLabel(r.status),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/admin/saved-quotes/search]", error);
    return NextResponse.json(
      { error: "고객 검색 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
