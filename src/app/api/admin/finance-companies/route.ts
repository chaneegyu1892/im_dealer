import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { isAdminLike } from "@/lib/admin-roles";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

export async function GET() {
  try {
    // 캐피탈사 가산율은 원가 구조 정보 — admin 이상만 조회 (PAGE_ACCESS /admin/finance 와 일치).
    const { error } = await requireRoleAtLeast("admin");
    if (error) return error;

    const financeCompanies = await prisma.financeCompany.findMany({
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: financeCompanies });
  } catch (error) {
    console.error("[GET /api/admin/finance-companies]", error);
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
    const surchargeRate = Number(body?.surchargeRate ?? 0);
    const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;

    if (!name || !code) {
      return NextResponse.json(
        { error: "캐피탈사명과 코드를 입력해 주세요." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(surchargeRate)) {
      return NextResponse.json(
        { error: "가산율은 숫자로 입력해 주세요." },
        { status: 400 }
      );
    }

    const duplicate = await prisma.financeCompany.findFirst({
      where: { OR: [{ name }, { code }] },
      select: { name: true, code: true },
    });
    if (duplicate) {
      const conflictField = duplicate.name === name ? "캐피탈사명" : "코드";
      return NextResponse.json(
        { error: `이미 등록된 ${conflictField}입니다.` },
        { status: 400 }
      );
    }

    const maxOrder = await prisma.financeCompany.aggregate({
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? 0) + 1;

    const created = await prisma.financeCompany.create({
      data: { name, code, surchargeRate, isActive, displayOrder },
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
  } catch (error) {
    console.error("[POST /api/admin/finance-companies]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
