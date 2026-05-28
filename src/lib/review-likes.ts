import { prisma } from "./prisma";

export interface ToggleLikeResult {
  liked: boolean;
  likeCount: number;
}

export async function toggleReviewLike(
  reviewId: string,
  anonId: string
): Promise<ToggleLikeResult | null> {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.findFirst({
      where: { id: reviewId, isPublic: true },
      select: { id: true },
    });
    if (!review) return null;

    const existing = await tx.reviewLike.findUnique({
      where: { reviewId_anonId: { reviewId, anonId } },
      select: { id: true },
    });

    if (existing) {
      await tx.reviewLike.delete({ where: { id: existing.id } });
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: Math.max(0, updated.likeCount) };
    }

    await tx.reviewLike.create({ data: { reviewId, anonId } });
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    return { liked: true, likeCount: updated.likeCount };
  });
}

export async function hasUserLiked(
  reviewId: string,
  anonId: string
): Promise<boolean> {
  const row = await prisma.reviewLike.findUnique({
    where: { reviewId_anonId: { reviewId, anonId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getLikedReviewIds(
  anonId: string,
  reviewIds: string[]
): Promise<Set<string>> {
  if (!reviewIds.length) return new Set();
  const rows = await prisma.reviewLike.findMany({
    where: { anonId, reviewId: { in: reviewIds } },
    select: { reviewId: true },
  });
  return new Set(rows.map((r) => r.reviewId));
}
