import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";

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

export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rank, rate } = await req.json();

    const updated = await prisma.rankSurchargeConfig.upsert({
      where: { rank: Number(rank) },
      update: { rate: Number(rate) },
      create: { rank: Number(rank), rate: Number(rate) },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
