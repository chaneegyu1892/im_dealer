import { prisma } from "../prisma";
import type {
  AdminQuoteAlimtalk,
  AdminQuoteDelivery,
  AdminQuoteDeliveryStatus,
  AdminSavedQuote,
} from "@/types/admin";
import { resolveQuoteContact } from "@/lib/quote-contact";
import { readSnapshotTrimPricing } from "@/lib/quote-snapshot-pricing";

function readBreakdown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const EMPTY_DELIVERY: AdminQuoteDelivery = {
  status: "NONE",
  failReason: null,
  createdAt: null,
  sentAt: null,
};

function toDeliveryStatus(status: string): Exclude<AdminQuoteDeliveryStatus, "NONE"> {
  if (status === "SENT" || status === "FAILED") return status;
  return "PENDING";
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
  const quoteIds = quotes.map((q) => q.id);
  const memberIds = [
    ...new Set(quotes.map((q) => q.userId).filter((id): id is string => Boolean(id))),
  ];

  const [vehicles, trims, members, deliveries, alimtalks] = await Promise.all([
    prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, brand: true },
    }),
    prisma.trim.findMany({
      where: { id: { in: trimIds } },
      select: { id: true, name: true, price: true, discountPrice: true },
    }),
    memberIds.length > 0
      ? prisma.user.findMany({
          where: { supabaseId: { in: memberIds } },
          select: { supabaseId: true, name: true, phone: true },
        })
      : Promise.resolve([]),
    quoteIds.length > 0
      ? prisma.quoteDelivery.findMany({
          where: { savedQuoteId: { in: quoteIds } },
          orderBy: { createdAt: "desc" },
          select: {
            savedQuoteId: true,
            status: true,
            failReason: true,
            createdAt: true,
            sentAt: true,
          },
        })
      : Promise.resolve([]),
    quoteIds.length > 0
      ? prisma.alimtalkMessage.findMany({
          where: { refType: "quote", refId: { in: quoteIds } },
          orderBy: { createdAt: "desc" },
          select: {
            refId: true,
            status: true,
            failReason: true,
            resultCode: true,
            templateKey: true,
            createdAt: true,
            resultAt: true,
          },
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

  const latestDeliveryByQuoteId = new Map<string, AdminQuoteDelivery>();
  for (const row of deliveries) {
    if (!row.savedQuoteId || latestDeliveryByQuoteId.has(row.savedQuoteId)) continue;
    latestDeliveryByQuoteId.set(row.savedQuoteId, {
      status: toDeliveryStatus(row.status),
      failReason: row.failReason,
      createdAt: row.createdAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
    });
  }

  const latestAlimtalkByQuoteId = new Map<string, AdminQuoteAlimtalk>();
  for (const row of alimtalks) {
    if (!row.refId || latestAlimtalkByQuoteId.has(row.refId)) continue;
    latestAlimtalkByQuoteId.set(row.refId, {
      status: row.status,
      failReason: row.failReason,
      resultCode: row.resultCode,
      templateKey: row.templateKey,
      createdAt: row.createdAt.toISOString(),
      resultAt: row.resultAt?.toISOString() ?? null,
    });
  }

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
    const snapshotPricing = readSnapshotTrimPricing(breakdown);
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
      trimName: (typeof breakdown.trimName === "string" && breakdown.trimName.trim()
        ? breakdown.trimName.trim()
        : null) ?? trim?.name ?? "삭제된 트림",
      trimPrice: snapshotPricing.trimPrice ?? trim?.price ?? null,
      discountPrice: snapshotPricing.source === "none"
        ? (trim?.discountPrice ?? null)
        : snapshotPricing.discountPrice,
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
      delivery: latestDeliveryByQuoteId.get(q.id) ?? EMPTY_DELIVERY,
      alimtalk: latestAlimtalkByQuoteId.get(q.id) ?? null,
    };
  });

  return { data, total };
}
