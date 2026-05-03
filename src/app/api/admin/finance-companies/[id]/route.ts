import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getAdminSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { surchargeRate } = await req.json();

    const before = await prisma.financeCompany.findUnique({ where: { id } });
    const updated = await prisma.financeCompany.update({
      where: { id },
      data: { surchargeRate: Number(surchargeRate) },
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
