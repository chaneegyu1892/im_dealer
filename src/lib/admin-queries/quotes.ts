import { prisma } from "../prisma";
import type { AdminSavedQuote } from "@/types/admin";

export async function getAdminQuotes(page = 1, limit = 20): Promise<{
  data: AdminSavedQuote[];
  total: number;
}> {
  const skip = (page - 1) * limit;

  const [quotes, total] = await Promise.all([
    prisma.savedQuote.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        exteriorColor: { select: { name: true, hexCode: true } },
        interiorColor: { select: { name: true, hexCode: true } },
      },
    }),
    prisma.savedQuote.count({ where: { deletedAt: null } }),
  ]);

  const vehicleIds = [...new Set(quotes.map((q) => q.vehicleId))];
  const trimIds = [...new Set(quotes.map((q) => q.trimId))];

  const [vehicles, trims] = await Promise.all([
    prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, brand: true },
    }),
    prisma.trim.findMany({
      where: { id: { in: trimIds } },
      select: { id: true, name: true },
    }),
  ]);

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const trimMap = new Map(trims.map((t) => [t.id, t]));

  const data: AdminSavedQuote[] = quotes.map((q) => {
    const vehicle = vehicleMap.get(q.vehicleId);
    const trim = trimMap.get(q.trimId);
    return {
      id: q.id,
      sessionId: q.sessionId,
      userId: q.userId,
      customerName: q.customerName,
      phone: q.phone,
      vehicleId: q.vehicleId,
      vehicleName: vehicle?.name ?? "삭제된 차량",
      vehicleBrand: vehicle?.brand ?? "",
      trimId: q.trimId,
      trimName: trim?.name ?? "삭제된 트림",
      contractMonths: q.contractMonths,
      annualMileage: q.annualMileage,
      depositRate: q.depositRate,
      prepayRate: q.prepayRate,
      contractType: q.contractType,
      monthlyPayment: q.monthlyPayment,
      totalCost: q.totalCost,
      status: q.status as AdminSavedQuote["status"],
      internalMemo: q.internalMemo,
      userType: q.userId ? "Member" : "Guest",
      quoteType: q.quoteType as AdminSavedQuote["quoteType"],
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
      exteriorColorName: q.exteriorColor?.name ?? null,
      exteriorColorHex: q.exteriorColor?.hexCode ?? null,
      interiorColorName: q.interiorColor?.name ?? null,
      interiorColorHex: q.interiorColor?.hexCode ?? null,
    };
  });

  return { data, total };
}
