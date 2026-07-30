import { prisma } from "@/lib/prisma";
import {
  QUOTE_IMAGE_RETENTION_DAYS,
} from "@/lib/quote-delivery/public-url";
import { deleteQuoteImage } from "@/lib/quote-delivery/store";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 50;

type QuoteDeliveryCandidate = {
  id: string;
  imagePath: string;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
};

export type QuoteImageCleanupFailure = {
  id: string;
  reason: string;
};

export type QuoteImageCleanupResult = {
  cutoff: Date;
  retentionDays: number;
  scanned: number;
  deleted: number;
  failures: QuoteImageCleanupFailure[];
};

/**
 * Remove quote PNGs after the retention window.
 *
 * Delivery status is deliberately not changed here: a Kakao send that already
 * succeeded remains SENT even when its public preview has expired. Cleanup
 * metadata is persisted separately so failures are visible and the same row is
 * selected again on the next cron run.
 */
export async function cleanupExpiredQuoteImages(options?: {
  now?: Date;
  batchSize?: number;
}): Promise<QuoteImageCleanupResult> {
  const now = options?.now ?? new Date();
  const batchSize = normalizeBatchSize(options?.batchSize);
  const cutoff = new Date(now.getTime() - QUOTE_IMAGE_RETENTION_DAYS * DAY_MS);

  const candidates = (await prisma.quoteDelivery.findMany({
    where: {
      imageDeletedAt: null,
      OR: [
        { status: "SENT", sentAt: { lte: cutoff } },
        { status: "SENT", sentAt: null, createdAt: { lte: cutoff } },
        { status: { in: ["PENDING", "FAILED"] }, createdAt: { lte: cutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      imagePath: true,
      status: true,
      createdAt: true,
      sentAt: true,
    },
  })) as QuoteDeliveryCandidate[];

  const failures: QuoteImageCleanupFailure[] = [];
  let deleted = 0;

  for (const candidate of candidates) {
    const attemptedAt = new Date();
    try {
      await deleteQuoteImage(candidate.imagePath);
      await prisma.quoteDelivery.update({
        where: { id: candidate.id },
        data: {
          imageDeletedAt: attemptedAt,
          imageCleanupAttempts: { increment: 1 },
          imageCleanupLastAttemptAt: attemptedAt,
          imageCleanupError: null,
        },
      });
      deleted += 1;
    } catch (error) {
      const reason = errorMessage(error);
      failures.push({ id: candidate.id, reason });
      await recordCleanupFailure(candidate.id, attemptedAt, reason);
    }
  }

  return {
    cutoff,
    retentionDays: QUOTE_IMAGE_RETENTION_DAYS,
    scanned: candidates.length,
    deleted,
    failures,
  };
}

function normalizeBatchSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(Math.floor(value as number), 500));
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500) || "unknown cleanup error";
}

async function recordCleanupFailure(id: string, attemptedAt: Date, reason: string): Promise<void> {
  try {
    await prisma.quoteDelivery.update({
      where: { id },
      data: {
        imageCleanupAttempts: { increment: 1 },
        imageCleanupLastAttemptAt: attemptedAt,
        imageCleanupError: reason,
      },
    });
  } catch (error) {
    // Keep the original storage failure visible even if recording its state
    // fails; the candidate remains eligible for the next retry cycle.
    console.error("[quote-image-lifecycle] cleanup state update failed:", {
      id,
      reason: errorMessage(error),
    });
  }
}
