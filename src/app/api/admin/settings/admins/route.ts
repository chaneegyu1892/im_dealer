import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { isAdminLike } from "@/lib/admin-roles";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || !isAdminLike(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admins = await prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: admins });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || !isAdminLike(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, isActive, role } = await req.json();

    const before = await prisma.adminUser.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    const updated = await prisma.adminUser.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(role && { role }),
      },
    });

    await logAdminAction({
      request: req,
      actor: session,
      action: "ACCOUNT_UPDATE",
      resource: "AdminUser",
      targetId: id,
      before,
      after: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, isActive: updated.isActive },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
