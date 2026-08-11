import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "./code";

const MAX_ATTEMPTS = 5;

/** 재시도를 모두 소진해도 유일한 코드를 못 잡은 경우. 호출자가 5xx 로 변환한다. */
export class ReferralCodeCollisionError extends Error {
  constructor(attempts: number) {
    super(`referral code generation failed after ${attempts} attempts`);
    this.name = "ReferralCodeCollisionError";
  }
}

/**
 * `User.referralCode` 의 유일 제약 위반. 이 트랜잭션이 쓰는 유일 컬럼은
 * referralCode 하나뿐이라 P2002 는 곧 코드 충돌이다.
 */
function isCodeCollision(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export interface ReferralCodeOwner {
  /** Prisma User.id */
  id: string;
  referralCode: string | null;
}

/**
 * 회원의 추천인 코드를 지연 생성한다. 코드는 한 번 정해지면 바뀌지 않으므로
 * 몇 번을 호출해도 같은 값을 돌려준다(멱등).
 *
 * 재시도 루프가 트랜잭션 *밖*에 있는 게 핵심이다. Postgres 는 유일 제약 위반이
 * 나면 트랜잭션 전체를 abort 시켜서, 같은 트랜잭션 안에서 다시 UPDATE 하면
 * 25P02 로 실패한다. 그래서 시도 1회 = 트랜잭션 1개로 묶는다.
 */
export async function ensureReferralCode(user: ReferralCodeOwner): Promise<string> {
  // 코드는 한 번 채워지면 비워지지 않는다 → non-null 스냅샷은 항상 유효하다.
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = generateReferralCode();
    try {
      const claimed = await prisma.$transaction(async (tx) => {
        // 동시 요청이 먼저 채웠을 수 있으니 트랜잭션 안에서 다시 확인한다.
        const fresh = await tx.user.findUnique({
          where: { id: user.id },
          select: { referralCode: true },
        });
        if (fresh?.referralCode) return fresh.referralCode;

        const updated = await tx.user.update({
          where: { id: user.id },
          data: { referralCode: candidate },
          select: { referralCode: true },
        });
        return updated.referralCode;
      });

      if (claimed) return claimed;
    } catch (error) {
      if (isCodeCollision(error)) continue;
      throw error;
    }
  }

  throw new ReferralCodeCollisionError(MAX_ATTEMPTS);
}
