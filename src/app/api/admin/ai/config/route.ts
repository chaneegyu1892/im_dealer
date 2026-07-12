import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { getRecommendationExclusion } from "@/lib/recommend/excluded-vehicles";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";
import { aiConfigMutationSchema } from "@/lib/validations/admin";

interface AuditableConfig {
  readonly id: string;
  readonly vehicleId: string;
  readonly scoreMatrix: unknown;
  readonly highlights: readonly string[];
  readonly aiCaption: string | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

function auditable(config: {
  readonly id: string;
  readonly vehicleId: string;
  readonly scoreMatrix: unknown;
  readonly highlights: readonly string[];
  readonly aiCaption: string | null;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}): AuditableConfig {
  return {
    id: config.id,
    vehicleId: config.vehicleId,
    scoreMatrix: config.scoreMatrix,
    highlights: config.highlights,
    aiCaption: config.aiCaption,
    isActive: config.isActive,
    updatedAt: config.updatedAt.toISOString(),
  };
}

const conflict = () => NextResponse.json(
  { error: "설정이 다른 관리자에 의해 변경되었습니다. 새로고침 후 다시 시도하세요." },
  { status: 409 }
);

export async function POST(req: NextRequest) {
  try {
    const { admin: session, error } = await requireRoleAtLeast("admin");
    if (error) return error;
    const parsed = aiConfigMutationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
      select: { id: true, slug: true, name: true, category: true, recConfigs: true },
    });
    if (!vehicle) return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });

    const existing = vehicle.recConfigs;
    if (input.action !== "deactivate" && getRecommendationExclusion(vehicle)) {
      return NextResponse.json({ error: "추천 제외 차량에는 프로필을 저장할 수 없습니다." }, { status: 400 });
    }

    const before: AuditableConfig | null = existing ? auditable(existing) : null;
    let updated;
    if (input.action === "deactivate") {
      if (!existing) return NextResponse.json({ error: "구성을 찾을 수 없습니다." }, { status: 404 });
      const result = await prisma.recommendationConfig.updateMany({
        where: { vehicleId: input.vehicleId, updatedAt: new Date(input.expectedUpdatedAt) },
        data: { isActive: false, updatedBy: session.email },
      });
      if (result.count !== 1) return conflict();
      updated = await prisma.recommendationConfig.findUniqueOrThrow({ where: { vehicleId: input.vehicleId } });
    } else if (input.action === "create") {
      if (existing) return conflict();
      updated = await prisma.recommendationConfig.create({
        data: {
          vehicleId: input.vehicleId,
          scoreMatrix: input.profile,
          highlights: input.highlights ?? [],
          aiCaption: input.aiCaption ?? null,
          isActive: input.isActive,
          updatedBy: session.email,
        },
      });
    } else {
      if (!existing) return conflict();
      const result = await prisma.recommendationConfig.updateMany({
        where: { vehicleId: input.vehicleId, updatedAt: new Date(input.expectedUpdatedAt) },
        data: {
          scoreMatrix: input.profile,
          isActive: input.isActive,
          ...(input.highlights !== undefined ? { highlights: input.highlights } : {}),
          ...(input.aiCaption !== undefined ? { aiCaption: input.aiCaption } : {}),
          updatedBy: session.email,
        },
      });
      if (result.count !== 1) return conflict();
      updated = await prisma.recommendationConfig.findUniqueOrThrow({ where: { vehicleId: input.vehicleId } });
    }

    const after = auditable(updated);
    await logAdminAction({
      request: req,
      actor: session,
      action: "AI_CONFIG_UPDATE",
      resource: "RecommendationConfig",
      targetId: updated.id,
      before,
      after,
    });
    revalidatePublicVehicleSurfaces();
    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return conflict();
    console.error("[AI_CONFIG_POST]", error);
    Sentry.captureException(error, { tags: { route: "admin/ai/config" } });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
