import type { Prisma, PrismaClient } from "@prisma/client";
import { generateReferralCode } from "./code";

type Db = PrismaClient | Prisma.TransactionClient;

const MAX_ATTEMPTS = 12;

/** 사용자에게 추천 코드가 없으면 발급해 반환한다. */
export async function ensureUserReferralCode(
  userId: string,
  db: Db,
): Promise<string> {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generateReferralCode();
    try {
      const updated = await db.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      if (updated.referralCode) return updated.referralCode;
    } catch {
      // unique 충돌 시 재시도
    }
  }

  throw new Error("Failed to allocate referral code");
}

/** 신규 유저 create 시 충돌 없는 코드를 찾는다. */
export async function allocateUniqueReferralCode(db: Db): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = generateReferralCode();
    const hit = await db.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!hit) return code;
  }
  throw new Error("Failed to allocate unique referral code");
}
