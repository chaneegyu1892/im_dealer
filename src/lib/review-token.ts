import { prisma } from "@/lib/prisma";

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
        },
      },
    },
  });

  if (!row) return { ok: false, reason: "not_found" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

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
