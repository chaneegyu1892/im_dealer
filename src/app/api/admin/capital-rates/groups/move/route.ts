import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { revalidatePublicVehicleSurfaces } from "@/lib/revalidate";

const moveSchema = z.object({
  targetGroupId: z.string().min(1),
  trimIds: z.array(z.string().min(1)).min(1),
});

function getWeekOf(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function copySheetValues(source: any) {
  return {
    minVehiclePrice: source.minVehiclePrice,
    maxVehiclePrice: source.maxVehiclePrice,
    minBaseRates: source.minBaseRates,
    minDepositRates: source.minDepositRates,
    minPrepayRates: source.minPrepayRates,
    maxBaseRates: source.maxBaseRates,
    maxDepositRates: source.maxDepositRates,
    maxPrepayRates: source.maxPrepayRates,
    minRateMatrix: source.minRateMatrix,
    maxRateMatrix: source.maxRateMatrix,
    depositDiscountRate: source.depositDiscountRate,
    prepayAdjustRate: source.prepayAdjustRate,
    memo: source.memo,
    groupId: source.groupId,
    isActive: true,
  };
}

// POST /api/admin/capital-rates/groups/move
// Move selected trims to an existing rate group by copying the group's rate values.
export async function POST(request: NextRequest) {
  const { admin: session, error } = await requireRoleAtLeast("admin");
  if (error) return error;

  try {
    const parsed = moveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetGroupId, trimIds } = parsed.data;
    const db = prisma as any;
    const targetGroup = await db.capitalRateGroup.findUnique({
      where: { id: targetGroupId },
      include: {
        rateSheets: {
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
    });

    const representative = targetGroup?.rateSheets?.[0];
    if (!targetGroup || !representative) {
      return NextResponse.json({ error: "대상 회수율 그룹을 찾을 수 없습니다." }, { status: 404 });
    }

    const targetTrims = await db.trim.findMany({
      where: { id: { in: trimIds } },
      select: { id: true, name: true, price: true, discountPrice: true },
    });
    if (targetTrims.length !== trimIds.length) {
      return NextResponse.json({ error: "일부 트림을 찾을 수 없습니다." }, { status: 404 });
    }

    const warnings = targetTrims
      .map((trim: any) => {
        const price = trim.discountPrice ?? trim.price;
        const outOfRange = price < representative.minVehiclePrice || price > representative.maxVehiclePrice;
        return outOfRange
          ? {
              trimId: trim.id,
              trimName: trim.name,
              price,
              minVehiclePrice: representative.minVehiclePrice,
              maxVehiclePrice: representative.maxVehiclePrice,
            }
          : null;
      })
      .filter(Boolean);

    const weekDate = getWeekOf();
    const results = await prisma.$transaction(async (tx) => {
      const moved: string[] = [];
      const copiedValues = copySheetValues(representative);

      for (const trimId of trimIds) {
        const current = await (tx as any).capitalRateSheet.findFirst({
          where: {
            financeCompanyId: representative.financeCompanyId,
            trimId,
            productType: representative.productType,
            isActive: true,
          },
        });

        if (current?.groupId === targetGroupId) {
          moved.push(current.id);
          continue;
        }

        await (tx as any).capitalRateSheet.updateMany({
          where: {
            financeCompanyId: representative.financeCompanyId,
            trimId,
            productType: representative.productType,
            isActive: true,
          },
          data: { isActive: false },
        });

        const sameWeek = await (tx as any).capitalRateSheet.findUnique({
          where: {
            financeCompanyId_trimId_weekOf_productType: {
              financeCompanyId: representative.financeCompanyId,
              trimId,
              weekOf: weekDate,
              productType: representative.productType,
            },
          },
        });

        if (sameWeek) {
          const updated = await (tx as any).capitalRateSheet.update({
            where: { id: sameWeek.id },
            data: copiedValues,
          });
          moved.push(updated.id);
        } else {
          const created = await (tx as any).capitalRateSheet.create({
            data: {
              financeCompanyId: representative.financeCompanyId,
              trimId,
              productType: representative.productType,
              weekOf: weekDate,
              ...copiedValues,
            },
          });
          moved.push(created.id);
        }
      }

      return moved;
    });

    await logAdminAction({
      request,
      actor: session,
      action: "RATE_SHEET_GROUP_MOVE",
      resource: "CapitalRateSheet",
      targetId: targetGroupId,
      meta: {
        targetGroupId,
        trimIds,
        sheetIds: results,
        financeCompanyId: representative.financeCompanyId,
        productType: representative.productType,
        warnings,
      },
    });
    revalidatePublicVehicleSurfaces();

    return NextResponse.json({ success: true, count: results.length, sheetIds: results, warnings });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "그룹 이동 실패" }, { status: 500 });
  }
}
