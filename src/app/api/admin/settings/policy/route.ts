import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const configs = await prisma.rankSurchargeConfig.findMany({
      orderBy: { rank: "asc" },
    });

    return NextResponse.json({ success: true, data: configs });
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

    const { rank, rate } = await req.json();

    const before = await prisma.rankSurchargeConfig.findUnique({
      where: { rank: Number(rank) },
    });
    const updated = await prisma.rankSurchargeConfig.upsert({
      where: { rank: Number(rank) },
      update: { rate: Number(rate) },
      create: { rank: Number(rank), rate: Number(rate) },
    });

    await logAdminAction({
      request: req,
      actor: session,
      action: "POLICY_UPDATE",
      resource: "RankSurchargeConfig",
      targetId: String(rank),
      before,
      after: updated,
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
