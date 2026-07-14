import { prisma } from "../prisma";
import type { AdminQuoteCalculation } from "@/types/admin";
import type { Prisma } from "@prisma/client";

type OptionSnapshot = AdminQuoteCalculation["selectedOptions"][number];

function parseOptionSnapshots(value: Prisma.JsonValue | null): OptionSnapshot[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || Array.isArray(item) || typeof item !== "object") return [];
    const option = item as Record<string, Prisma.JsonValue>;
    return typeof option.id === "string" &&
      typeof option.name === "string" &&
      typeof option.price === "number"
      ? [{ id: option.id, name: option.name, price: option.price }]
      : [];
  });
}

export async function getAdminQuoteCalculations(
  page = 1,
  limit = 50
): Promise<{ data: AdminQuoteCalculation[]; total: number }> {
  const skip = (page - 1) * limit;
  const resultOnlyWhere = { clickedApply: false } as const;
  const [rows, total] = await Promise.all([
    prisma.quoteCalcLog.findMany({
      where: resultOnlyWhere,
      orderBy: { calculatedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        sessionId: true,
        userId: true,
        vehicleId: true,
        vehicleSlug: true,
        vehicleName: true,
        vehicleBrand: true,
        trimId: true,
        trimName: true,
        trimPrice: true,
        discountPrice: true,
        optionIds: true,
        optionSnapshots: true,
        extraOptionsPrice: true,
        optionsTotalPrice: true,
        exteriorColorName: true,
        interiorColorName: true,
        colorDelta: true,
        totalVehiclePrice: true,
        contractMonths: true,
        annualMileage: true,
        depositRate: true,
        prepayRate: true,
        contractType: true,
        productType: true,
        customerType: true,
        resultMonthly: true,
        bestFinanceCompany: true,
        scenarioType: true,
        pricingStatus: true,
        clickedApply: true,
        deviceType: true,
        createdAt: true,
        calculatedAt: true,
      },
    }),
    prisma.quoteCalcLog.count({ where: resultOnlyWhere }),
  ]);

  const trimIds = [
    ...new Set(rows.map((row) => row.trimId).filter((id): id is string => Boolean(id))),
  ];
  const memberIds = [
    ...new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))),
  ];
  const optionIds = [...new Set(rows.flatMap((row) => row.optionIds))];

  const [trims, members, options] = await Promise.all([
    trimIds.length > 0
      ? prisma.trim.findMany({
          where: { id: { in: trimIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    memberIds.length > 0
      ? prisma.user.findMany({
          where: { supabaseId: { in: memberIds } },
          select: { supabaseId: true, name: true, phone: true },
        })
      : Promise.resolve([]),
    optionIds.length > 0
      ? prisma.trimOption.findMany({
          where: { id: { in: optionIds } },
          select: { id: true, name: true, price: true },
        })
      : Promise.resolve([]),
  ]);

  const trimMap = new Map(trims.map((trim) => [trim.id, trim.name]));
  const memberMap = new Map(
    members.flatMap((member) =>
      member.supabaseId ? [[member.supabaseId, member] as const] : []
    )
  );
  const optionMap = new Map(options.map((option) => [option.id, option]));

  const data = rows.map((row): AdminQuoteCalculation => {
    const member = row.userId ? memberMap.get(row.userId) : undefined;
    const snapshotOptions = parseOptionSnapshots(row.optionSnapshots);
    const selectedOptions =
      snapshotOptions.length > 0 || row.optionIds.length === 0
        ? snapshotOptions
        : row.optionIds.flatMap((id) => {
            const option = optionMap.get(id);
            return option ? [option] : [];
          });

    return {
      id: row.id,
      sessionId: row.sessionId,
      userId: row.userId,
      customerName: member?.name ?? null,
      phone: member?.phone ?? null,
      userType: row.userId ? "Member" : "Guest",
      vehicleId: row.vehicleId,
      vehicleSlug: row.vehicleSlug,
      vehicleName: row.vehicleName ?? row.vehicleSlug,
      vehicleBrand: row.vehicleBrand,
      trimId: row.trimId,
      trimName: row.trimName ?? (row.trimId ? trimMap.get(row.trimId) ?? null : null),
      optionCount: selectedOptions.length,
      selectedOptions,
      trimPrice: row.trimPrice,
      discountPrice: row.discountPrice,
      extraOptionsPrice: row.extraOptionsPrice,
      optionsTotalPrice: row.optionsTotalPrice,
      exteriorColorName: row.exteriorColorName,
      interiorColorName: row.interiorColorName,
      colorDelta: row.colorDelta,
      totalVehiclePrice: row.totalVehiclePrice,
      contractMonths: row.contractMonths,
      annualMileage: row.annualMileage,
      depositRate: row.depositRate,
      prepayRate: row.prepayRate,
      contractType: row.contractType,
      productType: row.productType,
      customerType: row.customerType,
      resultMonthly: row.resultMonthly,
      bestFinanceCompany: row.bestFinanceCompany,
      scenarioType: row.scenarioType,
      pricingStatus: row.pricingStatus,
      clickedApply: row.clickedApply,
      deviceType: row.deviceType,
      createdAt: row.createdAt.toISOString(),
      calculatedAt: row.calculatedAt.toISOString(),
    };
  });

  return { data, total };
}
