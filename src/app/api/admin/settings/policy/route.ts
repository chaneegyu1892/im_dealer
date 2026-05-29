import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { isAdminLike } from "@/lib/admin-roles";
import { z } from "zod";

// 순위 가산율은 견적 계산에 직접 영향을 주는 금융 데이터다. 빈/잘못된 입력으로
// rate=0(과소견적) 또는 rank=NaN 이 DB 에 들어가지 않도록 엄격히 검증한다.
const policySchema = z.object({
  rank: z.number().int().min(1).max(10),
  rate: z.number().min(0).max(10),
});

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
    if (!session || !isAdminLike(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = policySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { rank, rate } = parsed.data;

    const before = await prisma.rankSurchargeConfig.findUnique({
      where: { rank },
    });
    const updated = await prisma.rankSurchargeConfig.upsert({
      where: { rank },
      update: { rate },
      create: { rank, rate },
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
