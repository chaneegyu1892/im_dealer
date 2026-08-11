import { prisma } from "@/lib/prisma";
import {
  attributeReferral,
  type ReferralAttributionResult,
} from "./attribute";
import { REFERRAL_CODE_REGEX } from "./code";

/** 수동 추천인 코드 등록을 허용하는 계정 생성 후 기간(일). 그 이후엔 코드를 받지 않는다. */
export const REFERRAL_CLAIM_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ManualClaimPrecheck =
  | "noop" // 코드 미제출 — 아무 것도 하지 않는다
  | "ok" // 가드 통과 — attributeReferral 로 넘어간다
  | "rejected"; // 가드에서 거부(형식·이미 귀속·기간 초과)

export type ManualClaimReason =
  | "invalid_code"
  | "already_attributed"
  | "expired";

export interface ManualClaimResult {
  precheck: ManualClaimPrecheck;
  /** precheck === "rejected" 일 때만 채워지는 거부 사유 코드(PII 없음). */
  rejection?: ManualClaimReason;
  /** precheck === "ok" 일 때 attributeReferral 의 결과. */
  attribution?: ReferralAttributionResult;
}

/**
 * 회원이 직접 추천인 코드를 등록하는 공통 경로(/welcome 완료·/api/referral/claim).
 *
 * 사전 가드: (1) 코드 형식, (2) 이미 귀속된 회원 거부, (3) 계정 생성 후 7일 이내만 허용.
 * 통과하면 attributeReferral 로 자기추천·월한도·IP 임계가 강제된다.
 *
 * 완료(프로필 저장)를 막으면 안 되므로 진짜 장애만 throw 하고,
 * 거부는 precheck === "rejected" / attribution.status 로 표현한다.
 */
export async function manualReferralClaim({
  user,
  referralCode,
  ipHash = null,
  now = new Date(),
}: {
  user: {
    id: string;
    kakaoId?: string | null;
    phone?: string | null;
    email?: string | null;
    supabaseId?: string | null;
    createdAt?: Date | null;
  };
  referralCode?: string;
  ipHash?: string | null;
  now?: Date;
}): Promise<ManualClaimResult> {
  const code = (referralCode ?? "").trim().toUpperCase();
  if (!code) return { precheck: "noop" };

  if (!REFERRAL_CODE_REGEX.test(code)) {
    return { precheck: "rejected", rejection: "invalid_code" };
  }

  // 이미 귀속된 회원은 다시 받지 않는다(refereeId @unique 포함).
  const existing = await prisma.referral.findUnique({
    where: { refereeId: user.id },
    select: { id: true },
  });
  if (existing) return { precheck: "rejected", rejection: "already_attributed" };

  // 계정 생성 후 7일이 지나면 코드 등록을 거부한다.
  const createdAt = user.createdAt;
  if (!createdAt || now.getTime() - new Date(createdAt).getTime() >= REFERRAL_CLAIM_WINDOW_DAYS * MS_PER_DAY) {
    return { precheck: "rejected", rejection: "expired" };
  }

  const refereeUser = {
    id: user.id,
    kakaoId: user.kakaoId,
    phone: user.phone,
    email: user.email,
    supabaseId: user.supabaseId,
  };

  const attribution = await prisma.$transaction((tx) =>
    attributeReferral({ db: tx, refereeUser, referralCode: code, ipHash, now })
  );

  return { precheck: "ok", attribution };
}
