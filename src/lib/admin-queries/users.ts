import { prisma } from "../prisma";
import { supabaseAdmin } from "@/lib/supabase";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface AdminUserActiveItem {
  quoteId: string;
  vehicleName: string;
  statusRaw: string;
  statusLabel: string;
}

export interface AdminUserContractItem {
  quoteId: string;
  vehicleName: string;
  monthlyPayment: number;
  contractMonths: number;
  startDate: string;
  expectedEndDate: string;
  lifecycleStatus: "active" | "expiring_soon" | "expired";
  lifecycleLabel: string;
}

/**
 * 카카오싱크 간편가입으로 수집한 회원 정보(prisma.User).
 * 싱크 도입 이전 가입자는 재로그인 전까지 값이 비어 있다(소급 수집 불가).
 */
export interface AdminUserKakaoInfo {
  /** User.name — 동의항목 "이름"이 있으면 실명, 없으면 닉네임·이메일 기반 표시명 */
  memberName: string | null;
  memberPhone: string | null;
  memberEmail: string | null;
  kakaoId: string | null;
  kakaoNickname: string | null;
  /** "ADDED" | "BLOCKED" | "NONE" — plusfriends 스코프 미설정 시 항상 null */
  channelRelation: string | null;
  marketingConsent: boolean;
  /** 싱크 동의창을 통과한 시각. null 이면 싱크 이전 가입자 */
  consentedAt: string | null;
}

export interface AdminUserRecord {
  id: string;
  authUserId?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  provider?: string | null;
  source: "member" | "lead";
  consultationCount: number;
  contractCount: number;
  expiringSoonCount: number;
  joinedAt: string | null;
  lastSignInAt: string | null;
  firstContactAt: string;
  lastContactAt: string;
  userStatus: "active" | "dormant";
  role: string | null;
  activeItems: AdminUserActiveItem[];
  contractItems: AdminUserContractItem[];
  internalMemo: string | null;
  /** 회원(prisma.User) 행이 없는 비회원 리드는 null */
  kakaoInfo: AdminUserKakaoInfo | null;
}

export interface AdminUsersStats {
  total: number;
  active: number;
  dormant: number;
  newThisMonth: number;
  contracts: number;
  expiringSoon: number;
  /** 카카오싱크 동의 정보를 수집한 회원 수 */
  kakaoSynced: number;
}

function mapQuoteStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: "상담대기",
    CONTACTED: "상담중",
    IN_PROGRESS: "상담중",
    CONVERTED: "계약완료",
    LOST: "계약취소",
  };
  return map[status] ?? status;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getContractLifecycle(expectedEndDate: Date): {
  lifecycleStatus: AdminUserContractItem["lifecycleStatus"];
  lifecycleLabel: string;
} {
  const today = new Date();
  const daysUntilEnd = Math.ceil(
    (expectedEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilEnd < 0) {
    return { lifecycleStatus: "expired", lifecycleLabel: "예상 만료" };
  }
  if (daysUntilEnd <= 90) {
    return { lifecycleStatus: "expiring_soon", lifecycleLabel: "만기 임박" };
  }
  return { lifecycleStatus: "active", lifecycleLabel: "계약 진행" };
}

interface SupabaseAuthUserSummary {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  provider: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  phone: string | null;
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

const UNKNOWN_PHONE = "연락처 없음";
const MISSING_PHONE_VALUES = new Set(["", UNKNOWN_PHONE, "연락처 미입력", "010-0000-0000"]);
const MISSING_NORMALIZED_PHONES = new Set(["01000000000"]);

function normalizePhone(phone: string | null | undefined) {
  return phone?.replace(/\D/g, "") ?? "";
}

function getUsablePhone(phone: string | null | undefined) {
  const raw = phone?.trim() ?? "";
  const normalized = normalizePhone(raw);

  if (MISSING_PHONE_VALUES.has(raw) || MISSING_NORMALIZED_PHONES.has(normalized) || normalized.length < 8) {
    return null;
  }

  return raw;
}

function mapSupabaseUser(user: SupabaseUser): SupabaseAuthUserSummary {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const name =
    getMetadataString(metadata, ["name", "full_name", "user_name", "nickname"]) ??
    user.email?.split("@")[0] ??
    "회원";

  return {
    id: user.id,
    name,
    email: user.email ?? null,
    avatarUrl: getMetadataString(metadata, ["avatar_url", "picture"]),
    provider: getMetadataString(appMetadata, ["provider"]),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    phone:
      user.phone ??
      getMetadataString(metadata, ["phone", "phone_number", "mobile", "mobile_phone"]),
  };
}

interface SupabaseAuthUsersResult {
  users: SupabaseAuthUserSummary[];
  error?: string;
}

async function getSupabaseAuthUsers(): Promise<SupabaseAuthUsersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const message = "SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않아 회원 목록을 불러올 수 없습니다.";
    console.warn("[getAdminUsers]", message);
    return { users: [], error: message };
  }

  try {
    const admin = supabaseAdmin();
    const users: SupabaseAuthUserSummary[] = [];
    const perPage = 1000;

    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        const message = `Supabase 회원 목록 조회 실패: ${error.message}`;
        console.warn("[getAdminUsers]", message);
        return { users: [], error: message };
      }

      const pageUsers = data.users.map(mapSupabaseUser);
      users.push(...pageUsers);

      if (pageUsers.length < perPage) break;
    }

    return { users };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Supabase 회원 목록 조회 중 예외 발생: ${detail}`;
    console.warn("[getAdminUsers]", message);
    return { users: [], error: message };
  }
}

export async function getAdminUsers(): Promise<{
  users: AdminUserRecord[];
  stats: AdminUsersStats;
  authError?: string;
}> {
  const [quotes, authResult, dbMembers] = await Promise.all([
    prisma.savedQuote.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sessionId: true,
        userId: true,
        vehicleId: true,
        customerName: true,
        phone: true,
        status: true,
        contractMonths: true,
        monthlyPayment: true,
        convertedAt: true,
        createdAt: true,
        updatedAt: true,
        internalMemo: true,
      },
    }),
    getSupabaseAuthUsers(),
    // 역할 배지 + 카카오싱크 수집 정보. 싱크 데이터가 prisma.User 에만 있어 전체 회원을 가져온다.
    prisma.user.findMany({
      select: {
        supabaseId: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        kakaoId: true,
        kakaoNickname: true,
        channelRelation: true,
        marketingConsent: true,
        consentedAt: true,
      },
    }),
  ]);

  const authUsers = authResult.users;
  const authError = authResult.error;

  const adminMap = new Map<string, string>(); // supabaseId -> role
  const emailMap = new Map<string, string>(); // email -> role
  const kakaoInfoMap = new Map<string, AdminUserKakaoInfo>(); // supabaseId -> 싱크 정보
  dbMembers.forEach((m) => {
    if (m.role !== "member") {
      if (m.supabaseId) adminMap.set(m.supabaseId, m.role);
      if (m.email) emailMap.set(m.email, m.role);
    }
    if (m.supabaseId) {
      kakaoInfoMap.set(m.supabaseId, {
        memberName: m.name || null,
        memberPhone: m.phone,
        memberEmail: m.email,
        kakaoId: m.kakaoId,
        kakaoNickname: m.kakaoNickname,
        channelRelation: m.channelRelation,
        marketingConsent: m.marketingConsent,
        consentedAt: m.consentedAt?.toISOString() ?? null,
      });
    }
  });

  const vehicleIds = [...new Set(quotes.map((q) => q.vehicleId))];
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    select: { id: true, name: true },
  });
  const vehicleMap = new Map(vehicles.map((v) => [v.id, v.name]));

  const userMap = new Map<string, AdminUserRecord>();
  const phoneToAuthKey = new Map<string, string>();
  const duplicateAuthPhones = new Set<string>();

  for (const authUser of authUsers) {
    const contactDate = authUser.lastSignInAt ?? authUser.createdAt;
    const authKey = `auth:${authUser.id}`;
    const kakaoInfo = kakaoInfoMap.get(authUser.id) ?? null;
    // Supabase 메타에 전화번호가 없어도 카카오싱크로 받은 값이 있으면 그걸 쓴다.
    const authPhone = getUsablePhone(authUser.phone) ?? getUsablePhone(kakaoInfo?.memberPhone);

    userMap.set(authKey, {
      id: authUser.id,
      authUserId: authUser.id,
      name: authUser.name,
      phone: authPhone ?? UNKNOWN_PHONE,
      email: authUser.email,
      avatarUrl: authUser.avatarUrl,
      provider: authUser.provider,
      source: "member",
      consultationCount: 0,
      contractCount: 0,
      expiringSoonCount: 0,
      joinedAt: authUser.createdAt,
      lastSignInAt: authUser.lastSignInAt,
      firstContactAt: authUser.createdAt,
      lastContactAt: contactDate,
      userStatus: "active",
      role: adminMap.get(authUser.id) || (authUser.email ? emailMap.get(authUser.email) : null) || null,
      activeItems: [],
      contractItems: [],
      internalMemo: null,
      kakaoInfo,
    });

    if (authPhone) {
      const normalizedAuthPhone = normalizePhone(authPhone);
      const existingAuthKey = phoneToAuthKey.get(normalizedAuthPhone);

      if (existingAuthKey && existingAuthKey !== authKey) {
        duplicateAuthPhones.add(normalizedAuthPhone);
      } else {
        phoneToAuthKey.set(normalizedAuthPhone, authKey);
      }
    }
  }

  for (const q of quotes) {
    const quotePhone = getUsablePhone(q.phone);
    const normalizedQuotePhone = quotePhone ? normalizePhone(quotePhone) : null;
    const authKeyFromPhone =
      !q.userId && normalizedQuotePhone && !duplicateAuthPhones.has(normalizedQuotePhone)
        ? phoneToAuthKey.get(normalizedQuotePhone)
        : undefined;
    const mergeKey =
      q.userId
        ? `auth:${q.userId}`
        : authKeyFromPhone ??
          (normalizedQuotePhone ? `phone:${normalizedQuotePhone}` : `quote:${q.sessionId}`);
    const phone = quotePhone ?? UNKNOWN_PHONE;
    const name = q.customerName ?? phone;

    if (!userMap.has(mergeKey)) {
      userMap.set(mergeKey, {
        id: q.userId ?? q.sessionId,
        authUserId: q.userId,
        name,
        phone,
        email: null,
        avatarUrl: null,
        provider: null,
        source: q.userId ? "member" : "lead",
        consultationCount: 0,
        contractCount: 0,
        expiringSoonCount: 0,
        joinedAt: null,
        lastSignInAt: null,
        firstContactAt: q.createdAt.toISOString(),
        lastContactAt: q.createdAt.toISOString(),
        userStatus: "active",
        role: (q.userId ? adminMap.get(q.userId) : q.phone ? emailMap.get(q.phone) : null) ?? null,
        activeItems: [],
        contractItems: [],
        internalMemo: q.internalMemo ?? null,
        kakaoInfo: q.userId ? kakaoInfoMap.get(q.userId) ?? null : null,
      });
    }

    const user = userMap.get(mergeKey)!;
    if (q.customerName && (user.name === "회원" || user.name === user.email?.split("@")[0] || user.name === "연락처 없음")) {
      user.name = q.customerName;
    }
    if (quotePhone && user.phone === UNKNOWN_PHONE) {
      user.phone = quotePhone;
    }
    if (q.userId) {
      user.authUserId = q.userId;
      user.kakaoInfo ??= kakaoInfoMap.get(q.userId) ?? null;
      if (user.phone === UNKNOWN_PHONE) {
        user.phone = getUsablePhone(user.kakaoInfo?.memberPhone) ?? user.phone;
      }
    }
    if (q.userId || authKeyFromPhone) {
      user.source = "member";
    }
    user.consultationCount++;

    if (new Date(q.createdAt) < new Date(user.firstContactAt)) {
      user.firstContactAt = q.createdAt.toISOString();
      if (user.source === "lead") {
        user.id = q.sessionId;
      }
    }
    if (new Date(q.createdAt) > new Date(user.lastContactAt)) {
      user.lastContactAt = q.createdAt.toISOString();
      if (q.internalMemo) user.internalMemo = q.internalMemo;
    }

    if (q.status !== "LOST") {
      const vehicleName = vehicleMap.get(q.vehicleId) ?? "알 수 없음";
      user.activeItems.push({
        quoteId: q.id,
        vehicleName,
        statusRaw: q.status,
        statusLabel: mapQuoteStatusLabel(q.status),
      });

      if (q.status === "CONVERTED") {
        const startDate = q.convertedAt ?? q.updatedAt ?? q.createdAt;
        const expectedEndDate = addMonths(startDate, q.contractMonths);
        const lifecycle = getContractLifecycle(expectedEndDate);
        user.contractCount++;
        if (lifecycle.lifecycleStatus === "expiring_soon") {
          user.expiringSoonCount++;
        }
        user.contractItems.push({
          quoteId: q.id,
          vehicleName,
          monthlyPayment: q.monthlyPayment,
          contractMonths: q.contractMonths,
          startDate: startDate.toISOString(),
          expectedEndDate: expectedEndDate.toISOString(),
          ...lifecycle,
        });
      }
    }
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const users = [...userMap.values()].map((user) => ({
    ...user,
    userStatus:
      new Date(user.lastContactAt) < thirtyDaysAgo
        ? ("dormant" as const)
        : ("active" as const),
  }));

  users.sort(
    (a, b) =>
      new Date(b.lastSignInAt ?? b.lastContactAt).getTime() -
      new Date(a.lastSignInAt ?? a.lastContactAt).getTime()
  );

  const stats: AdminUsersStats = {
    total: users.length,
    active: users.filter((u) => u.userStatus === "active").length,
    dormant: users.filter((u) => u.userStatus === "dormant").length,
    newThisMonth: users.filter(
      (u) => new Date(u.firstContactAt) >= thisMonthStart
    ).length,
    kakaoSynced: users.filter((u) => u.kakaoInfo?.consentedAt).length,
    contracts: users.reduce((sum, u) => sum + u.contractCount, 0),
    expiringSoon: users.reduce((sum, u) => sum + u.expiringSoonCount, 0),
  };

  return { users, stats, authError };
}
