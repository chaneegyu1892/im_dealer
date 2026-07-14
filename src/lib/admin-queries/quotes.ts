import { prisma } from "../prisma";
import type { AdminSavedQuote } from "@/types/admin";
import { resolveQuoteContact } from "@/lib/quote-contact";

function readBreakdown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readSelectedOptions(value: unknown): AdminSavedQuote["selectedOptions"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const option = item as Record<string, unknown>;
    if (
      typeof option.id !== "string" ||
      typeof option.name !== "string" ||
      typeof option.price !== "number"
    ) return [];
    return [{ id: option.id, name: option.name, price: option.price }];
  });
}

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
  const memberIds = [
    ...new Set(quotes.map((q) => q.userId).filter((id): id is string => Boolean(id))),
  ];

  const [vehicles, trims, members] = await Promise.all([
    prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, brand: true },
    }),
    prisma.trim.findMany({
      where: { id: { in: trimIds } },
      select: { id: true, name: true },
    }),
    memberIds.length > 0
      ? prisma.user.findMany({
          where: { supabaseId: { in: memberIds } },
          select: { supabaseId: true, name: true, phone: true },
        })
      : Promise.resolve([]),
  ]);

  const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
  const trimMap = new Map(trims.map((t) => [t.id, t]));
  const memberMap = new Map(
    members.flatMap((member) =>
      member.supabaseId ? [[member.supabaseId, member] as const] : []
    )
  );

  const data: AdminSavedQuote[] = quotes.map((q) => {
    const vehicle = vehicleMap.get(q.vehicleId);
    const trim = trimMap.get(q.trimId);
    const member = q.userId ? memberMap.get(q.userId) : undefined;
    const contact = resolveQuoteContact({
      quoteName: q.customerName,
      quotePhone: q.phone,
      memberName: member?.name,
      memberPhone: member?.phone,
    });
    const breakdown = readBreakdown(q.breakdown);
    const productType = breakdown.productType === "리스" ? "리스" : "장기렌트";
    return {
      id: q.id,
      sessionId: q.sessionId,
      userId: q.userId,
      customerName: contact.customerName,
      phone: contact.phone,
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
      customerType: q.customerType,
      productType,
      monthlyPayment: q.monthlyPayment,
      totalCost: q.totalCost,
      pricingStatus: q.pricingStatus,
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
      selectedOptions: readSelectedOptions(breakdown.selectedOptions),
    };
  });

  return { data, total };
}
