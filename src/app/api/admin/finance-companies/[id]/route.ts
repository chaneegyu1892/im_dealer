import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { isAdminLike } from "@/lib/admin-roles";

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
    const update: {
      name?: string;
      code?: string;
      surchargeRate?: number;
      isActive?: boolean;
    } = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "캐피탈사명을 입력해 주세요." },
          { status: 400 }
        );
      }
      update.name = name;
    }
    if (typeof body?.code === "string") {
      const code = body.code.trim().toUpperCase();
      if (!code) {
        return NextResponse.json(
          { error: "코드를 입력해 주세요." },
          { status: 400 }
        );
      }
      update.code = code;
    }
    if (body?.surchargeRate !== undefined) {
      const surchargeRate = Number(body.surchargeRate);
      if (!Number.isFinite(surchargeRate)) {
        return NextResponse.json(
          { error: "가산율은 숫자로 입력해 주세요." },
          { status: 400 }
        );
      }
      update.surchargeRate = surchargeRate;
    }
    if (typeof body?.isActive === "boolean") {
      update.isActive = body.isActive;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "수정할 항목이 없습니다." },
        { status: 400 }
      );
    }

    if (update.name || update.code) {
      const conflictConditions: Array<{ name?: string; code?: string }> = [];
      if (update.name) conflictConditions.push({ name: update.name });
      if (update.code) conflictConditions.push({ code: update.code });
      const duplicate = await prisma.financeCompany.findFirst({
        where: { AND: [{ id: { not: id } }, { OR: conflictConditions }] },
        select: { name: true, code: true },
      });
      if (duplicate) {
        const conflictField =
          update.name && duplicate.name === update.name ? "캐피탈사명" : "코드";
        return NextResponse.json(
          { error: `이미 등록된 ${conflictField}입니다.` },
          { status: 400 }
        );
      }
    }

    const before = await prisma.financeCompany.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    const updated = await prisma.financeCompany.update({
      where: { id },
      data: update,
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
  } catch (error) {
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

    const before = await prisma.financeCompany.findUnique({ where: { id } });
    if (!before) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

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
