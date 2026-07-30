import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REVIEW_IMAGE_MAX_SIZE, reviewImagePublicUrl } from "@/lib/supabase/storage";

type ReviewTokenClient = Pick<Prisma.TransactionClient, "reviewRequestToken">;

export type TokenInvalidReason = "not_found" | "used" | "revoked" | "expired";

export interface ResolvedReviewToken {
  id: string;
  savedQuoteId: string;
  customerName: string | null;
  vehicleId: string | null;
  vehicleName: string | null;
  quoteCreatedAt: Date | null;
}

export type TokenResolution =
  | { ok: true; data: ResolvedReviewToken }
  | { ok: false; reason: TokenInvalidReason };

export const REVIEW_TOKEN_REASON_MESSAGE: Record<TokenInvalidReason, string> = {
  not_found: "유효하지 않은 링크입니다.",
  used: "이미 후기 작성이 완료된 링크입니다.",
  revoked: "사용이 중단된 링크입니다. 담당 딜러에게 문의해 주세요.",
  expired: "링크 사용 기간이 만료되었습니다.",
};

export const REVIEW_TOKEN_MAX_IMAGE_UPLOADS = 5;
export const REVIEW_TOKEN_MAX_IMAGE_BYTES = REVIEW_TOKEN_MAX_IMAGE_UPLOADS * REVIEW_IMAGE_MAX_SIZE;

export type ReviewImageUploadReservation =
  | { ok: true; data: { id: string; path: string; url: string } }
  | { ok: false; reason: "quota" | "invalid" };

export async function resolveReviewToken(token: string): Promise<TokenResolution> {
  const row = await prisma.reviewRequestToken.findUnique({
    where: { token },
    include: {
      savedQuote: {
        select: {
          id: true,
          customerName: true,
          createdAt: true,
          vehicleId: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!row) return { ok: false, reason: "not_found" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (!row.savedQuote || row.savedQuote.deletedAt) return { ok: false, reason: "revoked" };

  let vehicleName: string | null = null;
  if (row.savedQuote?.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: row.savedQuote.vehicleId },
      select: { name: true, brand: true },
    });
    if (vehicle) vehicleName = `${vehicle.brand} ${vehicle.name}`;
  }

  return {
    ok: true,
    data: {
      id: row.id,
      savedQuoteId: row.savedQuoteId,
      customerName: row.savedQuote?.customerName ?? null,
      vehicleId: row.savedQuote?.vehicleId ?? null,
      vehicleName,
      quoteCreatedAt: row.savedQuote?.createdAt ?? null,
    },
  };
}

/**
 * Revoke active public review capabilities derived from a quote.
 *
 * Callers that soft-delete a quote must pass their transaction client so the
 * parent deletion and capability revocation commit (or roll back) together.
 */
export async function revokeReviewTokensForQuote(
  savedQuoteId: string,
  client: ReviewTokenClient,
  revokedAt = new Date(),
): Promise<number> {
  const result = await client.reviewRequestToken.updateMany({
    where: {
      savedQuoteId,
      usedAt: null,
      revokedAt: null,
    },
    data: { revokedAt },
  });

  return result.count;
}

export async function reserveReviewImageUpload(params: {
  reviewRequestTokenId: string;
  byteSize: number;
  contentType: string;
}): Promise<ReviewImageUploadReservation> {
  const path = `${params.reviewRequestTokenId}/${randomUUID()}`;
  const url = reviewImagePublicUrl(path);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const reserved = await tx.reviewRequestToken.updateMany({
      where: {
        id: params.reviewRequestTokenId,
        savedQuote: { is: { deletedAt: null } },
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        imageUploadCount: { lt: REVIEW_TOKEN_MAX_IMAGE_UPLOADS },
        imageUploadBytes: { lte: REVIEW_TOKEN_MAX_IMAGE_BYTES - params.byteSize },
      },
      data: {
        imageUploadCount: { increment: 1 },
        imageUploadBytes: { increment: params.byteSize },
      },
    });

    if (reserved.count === 0) {
      const token = await tx.reviewRequestToken.findUnique({
        where: { id: params.reviewRequestTokenId },
        select: {
          usedAt: true,
          revokedAt: true,
          expiresAt: true,
          savedQuote: { select: { deletedAt: true } },
        },
      });
      if (
        !token ||
        token.usedAt ||
        token.revokedAt ||
        token.savedQuote?.deletedAt ||
        token.expiresAt.getTime() <= now.getTime()
      ) {
        return { ok: false, reason: "invalid" };
      }
      return { ok: false, reason: "quota" };
    }

    const upload = await tx.reviewImageUpload.create({
      data: {
        reviewRequestTokenId: params.reviewRequestTokenId,
        path,
        url,
        byteSize: params.byteSize,
        contentType: params.contentType,
      },
      select: { id: true, path: true, url: true },
    });
    return { ok: true, data: upload };
  });
}

export async function releaseReviewImageUpload(uploadId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const upload = await tx.reviewImageUpload.findUnique({
      where: { id: uploadId },
      select: { id: true, reviewRequestTokenId: true, byteSize: true, usedAt: true },
    });
    if (!upload || upload.usedAt) return;

    const removed = await tx.reviewImageUpload.deleteMany({
      where: { id: upload.id, usedAt: null },
    });
    if (removed.count === 0) return;

    await tx.reviewRequestToken.updateMany({
      where: { id: upload.reviewRequestTokenId },
      data: {
        imageUploadCount: { decrement: 1 },
        imageUploadBytes: { decrement: upload.byteSize },
      },
    });
  });
}
