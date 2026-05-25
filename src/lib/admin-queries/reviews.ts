import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "../prisma";
import { maskAuthorName, formatReviewDate, maskPhone } from "../review-utils";
import { compareBrandNames } from "../brand-sort";
import type {
  PublicReview,
  AdminReview,
  AdminReviewVehicleOption,
  ReviewRequestTokenSummary,
  ReviewRequestTokenStatus,
  PublicReviewListParams,
  PublicReviewListResult,
  ReviewSort,
} from "@/types/review";

type ReviewRow = Prisma.ReviewGetPayload<{
  include: { vehicle: { select: { name: true; brand: true } } };
}>;

function toPublicReview(r: ReviewRow): PublicReview {
  return {
    id: r.id,
    displayName: maskAuthorName(r.authorRealName),
    rating: r.rating,
    content: r.content,
    vehicleId: r.vehicleId,
    vehicleName: r.vehicle ? `${r.vehicle.brand} ${r.vehicle.name}` : null,
    vehicleBrand: r.vehicle?.brand ?? null,
    reviewDate: formatReviewDate(r.reviewDate),
    imageUrls: r.imageUrls,
    isBest: r.isBest,
    likeCount: r.likeCount,
  };
}

export async function getPublicReviews(limit = 10): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { isPublic: true },
    orderBy: [
      { isBest: "desc" },
      { displayOrder: "asc" },
      { reviewDate: "desc" },
    ],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map(toPublicReview);
}

export async function getPublicReviewsByVehicleId(
  vehicleId: string,
  limit = 10
): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({
    where: { isPublic: true, vehicleId },
    orderBy: [
      { isBest: "desc" },
      { displayOrder: "asc" },
      { reviewDate: "desc" },
    ],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map(toPublicReview);
}

// 메인 페이지 노출용: 좋아요 상위 N개. unstable_cache 로 24시간 캐시.
// 어드민이 후기를 변경하거나 isPublic 토글 시 revalidatePublicReviewSurfaces() 가
// 'home-top-liked-reviews' 태그를 무효화한다.
export const HOME_TOP_LIKED_REVIEWS_TAG = "home-top-liked-reviews";

export const getHomeTopLikedReviews = unstable_cache(
  async (limit: number): Promise<PublicReview[]> => {
    const rows = await prisma.review.findMany({
      where: { isPublic: true },
      orderBy: [
        { likeCount: "desc" },
        { reviewDate: "desc" },
        { id: "desc" },
      ],
      take: limit,
      include: { vehicle: { select: { name: true, brand: true } } },
    });
    return rows.map(toPublicReview);
  },
  ["home-top-liked-reviews"],
  { revalidate: 86400, tags: [HOME_TOP_LIKED_REVIEWS_TAG] }
);

export async function getBestReviews(opts: {
  vehicleId?: string;
  limit?: number;
}): Promise<PublicReview[]> {
  const { vehicleId, limit = 6 } = opts;
  const rows = await prisma.review.findMany({
    where: {
      isPublic: true,
      isBest: true,
      ...(vehicleId ? { vehicleId } : {}),
    },
    orderBy: [{ displayOrder: "asc" }, { reviewDate: "desc" }],
    take: limit,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  return rows.map(toPublicReview);
}

export async function getPublicReviewById(
  id: string
): Promise<PublicReview | null> {
  const row = await prisma.review.findFirst({
    where: { id, isPublic: true },
    include: { vehicle: { select: { name: true, brand: true } } },
  });
  return row ? toPublicReview(row) : null;
}

function buildOrderBy(sort: ReviewSort): Prisma.ReviewOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [
        { rating: "desc" },
        { reviewDate: "desc" },
        { id: "desc" },
      ];
    case "popular":
      return [
        { likeCount: "desc" },
        { reviewDate: "desc" },
        { id: "desc" },
      ];
    case "recent":
    default:
      return [{ reviewDate: "desc" }, { id: "desc" }];
  }
}

interface CursorPayload {
  reviewDate: string;
  id: string;
  rating?: number;
  likeCount?: number;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (
      typeof parsed?.reviewDate === "string" &&
      typeof parsed?.id === "string"
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listPublicReviews(
  params: PublicReviewListParams
): Promise<PublicReviewListResult> {
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 24);
  const sort = params.sort ?? "recent";

  const where: Prisma.ReviewWhereInput = { isPublic: true };
  if (params.vehicleId) where.vehicleId = params.vehicleId;
  else if (params.brand)
    where.vehicle = { is: { brand: params.brand } };
  const validRatings = (params.ratings ?? []).filter(
    (r) => Number.isInteger(r) && r >= 1 && r <= 5
  );
  if (validRatings.length > 0 && validRatings.length < 5) {
    where.rating = { in: validRatings };
  }
  if (params.withImages) {
    where.imageUrls = { isEmpty: false };
  }

  const cursor = params.cursor ? decodeCursor(params.cursor) : null;
  if (cursor) {
    const cursorDate = new Date(cursor.reviewDate);
    if (sort === "rating" && typeof cursor.rating === "number") {
      where.OR = [
        { rating: { lt: cursor.rating } },
        {
          rating: cursor.rating,
          reviewDate: { lt: cursorDate },
        },
        {
          rating: cursor.rating,
          reviewDate: cursorDate,
          id: { lt: cursor.id },
        },
      ];
    } else if (sort === "popular" && typeof cursor.likeCount === "number") {
      where.OR = [
        { likeCount: { lt: cursor.likeCount } },
        {
          likeCount: cursor.likeCount,
          reviewDate: { lt: cursorDate },
        },
        {
          likeCount: cursor.likeCount,
          reviewDate: cursorDate,
          id: { lt: cursor.id },
        },
      ];
    } else {
      where.OR = [
        { reviewDate: { lt: cursorDate } },
        { reviewDate: cursorDate, id: { lt: cursor.id } },
      ];
    }
  }

  const rows = await prisma.review.findMany({
    where,
    orderBy: buildOrderBy(sort),
    take: limit + 1,
    include: { vehicle: { select: { name: true, brand: true } } },
  });

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toPublicReview);
  const last = hasMore ? rows[limit - 1] : null;

  const nextCursor = last
    ? encodeCursor({
        reviewDate: last.reviewDate.toISOString(),
        id: last.id,
        rating: last.rating,
        likeCount: last.likeCount,
      })
    : null;

  return { items, nextCursor };
}

export async function getAllReviewsForAdmin(): Promise<AdminReview[]> {
  const rows = await prisma.review.findMany({
    orderBy: [
      { isBest: "desc" },
      { displayOrder: "asc" },
      { createdAt: "desc" },
    ],
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
    isBest: r.isBest,
    displayOrder: r.displayOrder,
    likeCount: r.likeCount,
    reviewDate: r.reviewDate.toISOString(),
    imageUrls: r.imageUrls,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getVehiclesForReviewSelect(): Promise<AdminReviewVehicleOption[]> {
  const rows = await prisma.vehicle.findMany({
    where: { isVisible: true },
    select: { id: true, name: true, brand: true },
  });
  // 어드민/공개 일관 정렬: 현대/기아/제네시스/BMW/벤츠 우선 + 가나다순
  // (Prisma orderBy로는 커스텀 우선순위 표현이 어려워 JS로 재정렬)
  return [...rows].sort((a, b) => {
    const brandDiff = compareBrandNames(a.brand, b.brand);
    if (brandDiff !== 0) return brandDiff;
    return a.name.localeCompare(b.name, "ko");
  });
}

function buildReviewWriteUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/reviews/write/${token}`;
}

function deriveTokenStatus(t: {
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): ReviewRequestTokenStatus {
  if (t.usedAt) return "used";
  if (t.revokedAt) return "revoked";
  if (t.expiresAt.getTime() <= Date.now()) return "expired";
  return "unused";
}

export async function getReviewRequestTokensForAdmin(): Promise<ReviewRequestTokenSummary[]> {
  const rows = await prisma.reviewRequestToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      savedQuote: {
        select: {
          id: true,
          customerName: true,
          phone: true,
          createdAt: true,
          vehicleId: true,
        },
      },
    },
  });

  const vehicleIds = Array.from(
    new Set(
      rows
        .map((r) => r.savedQuote?.vehicleId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const vehicles = vehicleIds.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: { id: true, name: true, brand: true },
      })
    : [];
  const vehicleMap = new Map(vehicles.map((v) => [v.id, `${v.brand} ${v.name}`]));

  return rows.map((r) => ({
    id: r.id,
    token: r.token,
    url: buildReviewWriteUrl(r.token),
    savedQuoteId: r.savedQuoteId,
    customerName: r.savedQuote?.customerName ?? null,
    customerPhoneMasked: r.savedQuote?.phone ? maskPhone(r.savedQuote.phone) : null,
    vehicleName: r.savedQuote?.vehicleId
      ? vehicleMap.get(r.savedQuote.vehicleId) ?? null
      : null,
    quoteCreatedAt: r.savedQuote?.createdAt
      ? formatReviewDate(r.savedQuote.createdAt)
      : null,
    status: deriveTokenStatus(r),
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    usedAt: r.usedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    reviewId: r.reviewId,
  }));
}
