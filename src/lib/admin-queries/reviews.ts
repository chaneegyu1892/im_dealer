import { prisma } from "../prisma";
import { maskAuthorName, formatReviewDate, maskPhone } from "../review-utils";
import type {
  PublicReview,
  AdminReview,
  AdminReviewVehicleOption,
} from "@/types/review";

export async function getPublicReviews(limit = 10): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { isPublic: true },
    orderBy: [{ displayOrder: "asc" }, { reviewDate: "desc" }],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    reviewDate: formatReviewDate(r.reviewDate),
  }));
}

export async function getPublicReviewsByVehicleId(
  vehicleId: string,
  limit = 10
): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { isPublic: true, vehicleId },
    orderBy: [{ displayOrder: "asc" }, { reviewDate: "desc" }],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    reviewDate: formatReviewDate(r.reviewDate),
  }));
}

export async function getAllReviewsForAdmin(): Promise<AdminReview[]> {
  const rows = await prisma.review.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: {
      vehicle: { select: { name: true, brand: true } },
      savedQuote: {
        select: {
          customerName: true,
          phone: true,
          createdAt: true,
          vehicleId: true,
        },
      },
    },
  });

  const sqVehicleIds = Array.from(
    new Set(
      rows
        .map((r) => r.savedQuote?.vehicleId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const sqVehicles = sqVehicleIds.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: sqVehicleIds } },
        select: { id: true, name: true, brand: true },
      })
    : [];
  const sqVehicleMap = new Map(sqVehicles.map((v) => [v.id, `${v.brand} ${v.name}`]));

  return rows.map((r) => ({
    id: r.id,
    authorRealName: r.authorRealName,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleId: r.vehicleId,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    savedQuoteId: r.savedQuoteId,
    linkedCustomerName: r.savedQuote?.customerName ?? null,
    linkedCustomerPhoneMasked: r.savedQuote?.phone ? maskPhone(r.savedQuote.phone) : null,
    linkedQuoteVehicleName: r.savedQuote?.vehicleId
      ? sqVehicleMap.get(r.savedQuote.vehicleId) ?? null
      : null,
    linkedQuoteCreatedAt: r.savedQuote?.createdAt
      ? formatReviewDate(r.savedQuote.createdAt)
      : null,
    isPublic: r.isPublic,
    displayOrder: r.displayOrder,
    reviewDate: r.reviewDate.toISOString(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getVehiclesForReviewSelect(): Promise<AdminReviewVehicleOption[]> {
  const rows = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: [{ brand: "asc" }, { name: "asc" }],
    select: { id: true, name: true, brand: true },
  });
  return rows;
}
