// 추천 인정 원장(Referral) 어드민 조회 (어드민 > 정책 및 AI > 추천인 원장).
// SSR 전용 스냅샷 — 상태 변경은 /api/admin/referrals/[id]/status 가 담당한다.

import type { ReferralStatus } from "@prisma/client";
import { prisma } from "../prisma";

export const REFERRAL_LEDGER_STATUSES = [
  "REWARDED",
  "BLOCKED",
  "REVOKED",
] as const satisfies readonly ReferralStatus[];

export type ReferralStatusFilter = "ALL" | (typeof REFERRAL_LEDGER_STATUSES)[number];

export const REFERRAL_PAGE_SIZE = 20;

export interface ReferralLedgerUserRef {
  /** 원본 유저 id 는 내려가되 화면 표기는 masked 로만 쓴다. */
  id: string;
  /** PII 마스킹 식별자 — 이메일 우선, 없으면 이름/닉네임, 최후엔 id 접두사 */
  masked: string;
}

export interface ReferralLedgerItem {
  id: string;
  code: string;
  status: ReferralStatus;
  createdAt: string;
  /** 가입 시점 IP 해시 — 해시라 원문 IP 복원 불가(PII 비노출) */
  signupIpHash: string | null;
  referrer: ReferralLedgerUserRef;
  referee: ReferralLedgerUserRef;
}

export interface ReferralLedgerPage {
  items: ReferralLedgerItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusFilter: ReferralStatusFilter;
  counts: Record<(typeof REFERRAL_LEDGER_STATUSES)[number], number>;
}

/** 이메일 마스킹 — 로컬 앞 2자리만 노출(mypage maskEmail 과 동일 규칙). */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "등록됨";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

/** 이름/닉네임 마스킹 — 첫 글자만 노출. 1글자면 전체 마스크. */
function maskName(name: string): string {
  if (name.length <= 1) return "*";
  return `${name[0]}${"*".repeat(name.length - 1)}`;
}

function maskUserRef(user: {
  id: string;
  email: string | null;
  name: string | null;
  kakaoNickname: string | null;
}): ReferralLedgerUserRef {
  if (user.email) {
    return { id: user.id, masked: maskEmail(user.email) };
  }
  const name = user.kakaoNickname ?? user.name;
  if (name) {
    return { id: user.id, masked: maskName(name) };
  }
  return { id: user.id, masked: `${user.id.slice(0, 7)}…` };
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function parseStatusFilter(raw: string | undefined): ReferralStatusFilter {
  if (raw && (REFERRAL_LEDGER_STATUSES as readonly string[]).includes(raw)) {
    return raw as ReferralStatusFilter;
  }
  return "ALL";
}

export async function getAdminReferralPage(searchParams: {
  page?: string;
  status?: string;
}): Promise<ReferralLedgerPage> {
  const page = parsePage(searchParams.page);
  const statusFilter = parseStatusFilter(searchParams.status);
  const where = statusFilter === "ALL" ? {} : { status: statusFilter };

  // findMany 의 select 에 referrer/referee 관계를 포함해 Prisma 가 조인으로 해결한다 —
  // 행마다 사용자를 재조회하지 않으므로 페이지네이션에서 N+1 이 없다.
  const [rows, total, statusGroups] = await Promise.all([
    prisma.referral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * REFERRAL_PAGE_SIZE,
      take: REFERRAL_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        signupIpHash: true,
        referrer: { select: { id: true, email: true, name: true, kakaoNickname: true } },
        referee: { select: { id: true, email: true, name: true, kakaoNickname: true } },
      },
    }),
    prisma.referral.count({ where }),
    prisma.referral.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts: Record<(typeof REFERRAL_LEDGER_STATUSES)[number], number> = {
    REWARDED: 0,
    BLOCKED: 0,
    REVOKED: 0,
  };
  for (const group of statusGroups) {
    if ((REFERRAL_LEDGER_STATUSES as readonly string[]).includes(group.status)) {
      counts[group.status as (typeof REFERRAL_LEDGER_STATUSES)[number]] = group._count._all;
    }
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      signupIpHash: row.signupIpHash,
      referrer: maskUserRef(row.referrer),
      referee: maskUserRef(row.referee),
    })),
    total,
    page,
    pageSize: REFERRAL_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / REFERRAL_PAGE_SIZE)),
    statusFilter,
    counts,
  };
}
