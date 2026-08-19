import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_TTL_DAYS = 30;

export type IssuedReviewToken = {
  readonly id: string;
  readonly token: string;
  readonly url: string;
  readonly expiresAt: Date;
  readonly reused: boolean;
};

export function buildReviewUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return `${base}/reviews/write/${token}`;
}

export async function issueOrReuseReviewToken(params: {
  readonly quoteId: string;
  readonly createdById: string;
}): Promise<IssuedReviewToken> {
  const now = new Date();
  const existing = await prisma.reviewRequestToken.findFirst({
    where: {
      savedQuoteId: params.quoteId,
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return {
      id: existing.id,
      token: existing.token,
      url: buildReviewUrl(existing.token),
      expiresAt: existing.expiresAt,
      reused: true,
    };
  }

  const expiresAt = new Date(now.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = randomUUID();
  const created = await prisma.reviewRequestToken.create({
    data: {
      token,
      savedQuoteId: params.quoteId,
      expiresAt,
      createdById: params.createdById,
    },
  });

  return {
    id: created.id,
    token: created.token,
    url: buildReviewUrl(created.token),
    expiresAt: created.expiresAt,
    reused: false,
  };
}
