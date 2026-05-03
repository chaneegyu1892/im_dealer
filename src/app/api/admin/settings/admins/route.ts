import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") {
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

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, password, name, role } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const exists = await prisma.adminUser.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Already exists" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || "staff",
      },
    });

    await logAdminAction({
      request: req,
      actor: session,
      action: "ACCOUNT_CREATE",
      resource: "AdminUser",
      targetId: newUser.id,
      after: { email: newUser.email, name: newUser.name, role: newUser.role },
    });

    return NextResponse.json({
      success: true,
      data: { id: newUser.id, email: newUser.email, name: newUser.name },
    });
  } catch (error) {
    console.error("[ADMINS_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") {
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
