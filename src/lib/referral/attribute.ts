import type { Prisma, PrismaClient } from "@prisma/client";
import { generateCouponCode } from "@/lib/coupons/code";
import { toE164KR } from "@/lib/phone";
// 코드 형식은 생성기와 한 곳에서 공유한다. 쿠키·수동 입력 등 신뢰할 수 없는 경로로
// 들어오므로 DB 를 때리기 전에 모양부터 거른다.
import { REFERRAL_CODE_REGEX } from "./code";

export type ReferralDb = PrismaClient | Prisma.TransactionClient;

/** 한 추천인이 한 달(달력 기준)에 보상받을 수 있는 최대 추천 수. */
export const MONTHLY_REWARD_CAP = 10;
/** 같은 IP 해시로 24시간 안에 성립한 추천이 이 수에 도달하면 더 이상 보상하지 않는다. */
export const IP_SIGNUP_THRESHOLD = 3;
const IP_WINDOW_MS = 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReferralAttributionStatus = "REWARDED" | "BLOCKED" | "SKIPPED";

export type ReferralAttributionReason =
  | "invalid_code"
  | "referrer_not_found"
  | "referrer_inactive"
  | "self_referral"
  | "monthly_cap"
  | "ip_threshold"
  | "already_attributed"
  | "policy_missing";

export interface ReferralAttributionResult {
  status: ReferralAttributionStatus;
  /** 로그·응답에 실어도 되는 사유 코드. PII 를 담지 않는다. */
  reason?: ReferralAttributionReason;
  referralId?: string;
}

/** 자기추천 판정에 쓰는 피추천인 식별자 묶음. 값은 밖으로 나가지 않는다. */
export interface ReferralRefereeView {
  id: string;
  kakaoId?: string | null;
  phone?: string | null;
  email?: string | null;
  supabaseId?: string | null;
}

export interface AttributeReferralInput {
  /** 호출자가 연 트랜잭션 클라이언트. 조회·쓰기가 모두 여기서 일어난다. */
  db: ReferralDb;
  refereeUser: ReferralRefereeView;
  referralCode: string;
  /** 원문 IP 금지 — src/lib/ip-hash.ts 의 해시만 받는다. */
  ipHash?: string | null;
  now?: Date;
}

interface ReferrerView {
  id: string;
  isActive: boolean;
  kakaoId: string | null;
  phone: string | null;
  email: string | null;
  supabaseId: string | null;
}

/** Prisma 의 유일 제약 위반. 테스트 더블도 통과하도록 덕 타이핑으로 본다. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** 달력 기준 이번 달 1일 00:00 (서버 로컬 시간). 월 한도의 기준점. */
function startOfCalendarMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function sameNonEmpty(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** 전화는 포맷이 섞여 들어오므로(하이픈·+82) 반드시 정규화 후 비교한다. */
function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = toE164KR(a);
  const right = toE164KR(b);
  if (!left || !right) return false;
  return left === right;
}

/**
 * 같은 사람이 계정을 두 개 만들어 스스로를 추천하는 경우를 잡는다.
 * 어느 한 식별자라도 일치하면 동일인으로 본다.
 */
function isSelfReferral(referrer: ReferrerView, referee: ReferralRefereeView): boolean {
  if (referrer.id === referee.id) return true;
  if (sameNonEmpty(referrer.kakaoId, referee.kakaoId)) return true;
  if (sameNonEmpty(referrer.supabaseId, referee.supabaseId)) return true;
  if (sameEmail(referrer.email, referee.email)) return true;
  if (samePhone(referrer.phone, referee.phone)) return true;
  return false;
}

/**
 * 추천 1건을 기록한다. 피추천인은 평생 1회만 귀속된다(refereeId @unique).
 *
 * 이미 귀속된 회원은 create 를 시도하지 않고 미리 걸러낸다. Postgres 는 트랜잭션
 * 안에서 유일 제약이 깨지면 그 트랜잭션 전체를 abort 시켜(25P02) 이후 쿼리가 모두
 * 실패하므로, P2002 를 잡아 이어가는 방식은 트랜잭션 안에서 통하지 않는다.
 * catch 는 두 콜백이 동시에 들어오는 경합 상황의 안전망으로만 남긴다 — 그 경우
 * 트랜잭션이 롤백되어 아무 것도 기록되지 않는다.
 */
async function createReferralRow(
  db: ReferralDb,
  data: {
    referrerId: string;
    refereeId: string;
    code: string;
    status: "REWARDED" | "BLOCKED";
    signupIpHash: string | null;
  }
): Promise<{ id: string } | null> {
  const existing = await db.referral.findUnique({
    where: { refereeId: data.refereeId },
    select: { id: true },
  });
  if (existing) return null;

  try {
    return await db.referral.create({ data, select: { id: true } });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/**
 * 추천인 코드로 들어온 신규 가입에 추천을 귀속시키고 양쪽 보상 쿠폰을 발급한다.
 *
 * 호출자가 연 트랜잭션 안에서만 쓴다. 실패는 예외가 아니라 status 로 표현하므로
 * 로그인 흐름을 끊지 않는다(진짜 장애만 throw).
 *
 * - SKIPPED: 귀속할 대상이 없다(코드 오류·추천인 부재/비활성·이미 귀속됨). 행도 쿠폰도 없음.
 * - BLOCKED: 추천은 기록하되 남용으로 보고 보상하지 않는다(자기추천·월 한도·IP 임계).
 * - REWARDED: Referral 1행 + 추천인/피추천인 쿠폰 2장(HELD).
 */
export async function attributeReferral({
  db,
  refereeUser,
  referralCode,
  ipHash = null,
  now = new Date(),
}: AttributeReferralInput): Promise<ReferralAttributionResult> {
  const code = referralCode.trim().toUpperCase();
  if (!REFERRAL_CODE_REGEX.test(code)) {
    return { status: "SKIPPED", reason: "invalid_code" };
  }

  const referrer = (await db.user.findUnique({
    where: { referralCode: code },
    select: { id: true, isActive: true, kakaoId: true, phone: true, email: true, supabaseId: true },
  })) as ReferrerView | null;

  if (!referrer) return { status: "SKIPPED", reason: "referrer_not_found" };
  if (!referrer.isActive) return { status: "SKIPPED", reason: "referrer_inactive" };

  const blockedFor = await resolveBlockReason({ db, referrer, refereeUser, ipHash, now });
  if (blockedFor) {
    // 차단이어도 기록은 남긴다 — 남용 패턴 추적과 재시도 차단의 근거가 된다.
    const blocked = await createReferralRow(db, {
      referrerId: referrer.id,
      refereeId: refereeUser.id,
      code,
      status: "BLOCKED",
      signupIpHash: ipHash,
    });
    if (!blocked) return { status: "SKIPPED", reason: "already_attributed" };
    return { status: "BLOCKED", reason: blockedFor, referralId: blocked.id };
  }

  const referral = await createReferralRow(db, {
    referrerId: referrer.id,
    refereeId: refereeUser.id,
    code,
    status: "REWARDED",
    signupIpHash: ipHash,
  });
  if (!referral) return { status: "SKIPPED", reason: "already_attributed" };

  const issued = await issueReferralCoupons({
    db,
    referralId: referral.id,
    referrerId: referrer.id,
    refereeId: refereeUser.id,
    now,
  });

  return {
    status: "REWARDED",
    referralId: referral.id,
    ...(issued === 2 ? {} : { reason: "policy_missing" as const }),
  };
}

async function resolveBlockReason({
  db,
  referrer,
  refereeUser,
  ipHash,
  now,
}: {
  db: ReferralDb;
  referrer: ReferrerView;
  refereeUser: ReferralRefereeView;
  ipHash: string | null;
  now: Date;
}): Promise<ReferralAttributionReason | null> {
  if (isSelfReferral(referrer, refereeUser)) return "self_referral";

  const monthlyCount = await db.referral.count({
    where: {
      referrerId: referrer.id,
      status: "REWARDED",
      createdAt: { gte: startOfCalendarMonth(now) },
    },
  });
  if (monthlyCount >= MONTHLY_REWARD_CAP) return "monthly_cap";

  if (ipHash) {
    const ipCount = await db.referral.count({
      where: { signupIpHash: ipHash, createdAt: { gte: new Date(now.getTime() - IP_WINDOW_MS) } },
    });
    if (ipCount >= IP_SIGNUP_THRESHOLD) return "ip_threshold";
  }

  return null;
}

/**
 * 추천인(REFERRAL_GIVEN)·피추천인(REFERRAL_RECEIVED) 쿠폰을 발급한다.
 *
 * 둘 다 HELD 로 시작한다. 지급 여부는 어드민이 계약 확인 후 결정하고,
 * `reconcileUserCoupons` 는 referralId 가 붙은 쿠폰을 건드리지 않는다.
 * 반환값은 실제로 만든 장수(정책이 비활성/부재면 그만큼 줄어든다).
 */
async function issueReferralCoupons({
  db,
  referralId,
  referrerId,
  refereeId,
  now,
}: {
  db: ReferralDb;
  referralId: string;
  referrerId: string;
  refereeId: string;
  now: Date;
}): Promise<number> {
  const policies = await db.couponPolicy.findMany({
    where: { trigger: { in: ["REFERRAL_GIVEN", "REFERRAL_RECEIVED"] }, isActive: true },
    select: {
      id: true,
      trigger: true,
      title: true,
      rewardLabel: true,
      rewardAmount: true,
      validDays: true,
    },
  });

  const data = policies.map((policy) => ({
    userId: policy.trigger === "REFERRAL_GIVEN" ? referrerId : refereeId,
    policyId: policy.id,
    code: generateCouponCode(),
    status: "HELD" as const,
    titleSnapshot: policy.title,
    rewardLabelSnapshot: policy.rewardLabel,
    rewardAmountSnapshot: policy.rewardAmount,
    expiresAt:
      policy.validDays === null || policy.validDays === undefined
        ? null
        : new Date(now.getTime() + policy.validDays * MS_PER_DAY),
    referralId,
  }));

  if (data.length === 0) return 0;

  await db.issuedCoupon.createMany({ data, skipDuplicates: true });
  return data.length;
}
