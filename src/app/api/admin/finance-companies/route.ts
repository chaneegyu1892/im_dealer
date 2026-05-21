import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { isAdminLike } from "@/lib/admin-roles";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const financeCompanies = await prisma.financeCompany.findMany({
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: financeCompanies });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !isAdminLike(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim().toUpperCase();
    const surchargeRate = Number(body.surchargeRate ?? 0);
    const isActive = body.isActive ?? true;

    if (!name || !code) {
      return NextResponse.json({ error: "캐피탈사명과 코드는 필수입니다." }, { status: 400 });
    }

    if (!Number.isFinite(surchargeRate)) {
      return NextResponse.json({ error: "가산율은 숫자여야 합니다." }, { status: 400 });
    }

    const last = await prisma.financeCompany.findFirst({
      orderBy: { displayOrder: "desc" },
      select: { displayOrder: true },
    });

    const created = await prisma.financeCompany.create({
      data: {
        name,
        code,
        surchargeRate,
        isActive: Boolean(isActive),
        displayOrder: (last?.displayOrder ?? 0) + 1,
      },
    });

    await logAdminAction({
      request: req,
      actor: session,
      action: "FINANCE_COMPANY_CREATE",
      resource: "FinanceCompany",
      targetId: created.id,
      after: created,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "이미 사용 중인 캐피탈사명 또는 코드입니다." }, { status: 409 });
    }
    console.error("[POST /api/admin/finance-companies]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
