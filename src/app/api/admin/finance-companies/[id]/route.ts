import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { isAdminLike } from "@/lib/admin-roles";

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session || !isAdminLike(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const updateData: {
      name?: string;
      code?: string;
      surchargeRate?: number;
      isActive?: boolean;
      displayOrder?: number;
    } = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "캐피탈사명은 필수입니다." }, { status: 400 });
      updateData.name = name;
    }
    if (body.code !== undefined) {
      const code = String(body.code).trim().toUpperCase();
      if (!code) return NextResponse.json({ error: "코드는 필수입니다." }, { status: 400 });
      updateData.code = code;
    }
    if (body.surchargeRate !== undefined) {
      const surchargeRate = Number(body.surchargeRate);
      if (!Number.isFinite(surchargeRate)) {
        return NextResponse.json({ error: "가산율은 숫자여야 합니다." }, { status: 400 });
      }
      updateData.surchargeRate = surchargeRate;
    }
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.displayOrder !== undefined) {
      const displayOrder = Number(body.displayOrder);
      if (!Number.isInteger(displayOrder)) {
        return NextResponse.json({ error: "정렬 순서는 정수여야 합니다." }, { status: 400 });
      }
      updateData.displayOrder = displayOrder;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "수정할 값이 없습니다." }, { status: 400 });
    }

    const before = await prisma.financeCompany.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "캐피탈사를 찾을 수 없습니다." }, { status: 404 });

    const updated = await prisma.financeCompany.update({
      where: { id },
      data: updateData,
    });

    await logAdminAction({
      request: req,
      actor: session,
      action: "FINANCE_COMPANY_UPDATE",
      resource: "FinanceCompany",
      targetId: id,
      before,
      after: updated,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "이미 사용 중인 캐피탈사명 또는 코드입니다." }, { status: 409 });
    }
    console.error("[PATCH /api/admin/finance-companies/[id]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session || !isAdminLike(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const before = await prisma.financeCompany.findUnique({
      where: { id },
      include: { _count: { select: { rateSheets: true, inventories: true } } },
    });
    if (!before) return NextResponse.json({ error: "캐피탈사를 찾을 수 없습니다." }, { status: 404 });

    await prisma.financeCompany.delete({ where: { id } });

    await logAdminAction({
      request: req,
      actor: session,
      action: "FINANCE_COMPANY_DELETE",
      resource: "FinanceCompany",
      targetId: id,
      before,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/finance-companies/[id]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
