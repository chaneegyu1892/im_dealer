import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@prisma/client";
import { ADMIN_ROLES, type AdminRole } from "@/lib/admin-roles";
import { cookies } from "next/headers";
import {
  getVehicleImageE2EAdmin,
  VEHICLE_IMAGE_E2E_ADMIN_COOKIE,
} from "@/lib/vehicle-images/e2e-admin-session";

const UNAUTHENTICATED_ERROR_NAMES = new Set([
  "AuthSessionMissingError",
  "AuthInvalidJwtError",
]);

const UNAUTHENTICATED_ERROR_CODES = new Set([
  "bad_jwt",
  "invalid_jwt",
  "session_not_found",
  "user_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
]);

export class SessionLookupError extends Error {
  readonly retryable = true as const;

  constructor(message = "로그인 상태를 확인하지 못했습니다.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SessionLookupError";
  }
}

function readStringField(error: object, key: string): string {
  if (!(key in error)) return "";
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function isUnauthenticatedSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = readStringField(error, "name");
  const code = readStringField(error, "code");
  const status =
    "status" in error && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  if (UNAUTHENTICATED_ERROR_NAMES.has(name)) return true;
  if (UNAUTHENTICATED_ERROR_CODES.has(code)) return true;
  if (status === 401 || status === 403) return true;
  return false;
}

export function rethrowUnlessUnauthenticated(error: unknown): void {
  if (error instanceof SessionLookupError) throw error;
  if (isUnauthenticatedSessionError(error)) return;
  console.error(
    "[getCurrentUser] Supabase session check failed:",
    error instanceof Error ? error.message : "unknown error"
  );
  throw new SessionLookupError("로그인 상태를 확인하지 못했습니다.", { cause: error });
}

// 현재 로그인된 사용자 행 반환 (member 포함, isActive 무관 — 호출자에서 처리)
export async function getCurrentUser(): Promise<User | null> {
  if (process.env.VEHICLE_IMAGE_STORAGE_DRIVER === "filesystem-e2e") {
    const cookieStore = await cookies();
    return getVehicleImageE2EAdmin(cookieStore.get(VEHICLE_IMAGE_E2E_ADMIN_COOKIE)?.value);
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!user) {
      if (error) rethrowUnlessUnauthenticated(error);
      return null;
    }
    return prisma.user.findUnique({ where: { supabaseId: user.id } });
  } catch (error: unknown) {
    rethrowUnlessUnauthenticated(error);
    return null;
  }
}

// 어드민 가드 — member/inactive 는 차단한다.
// 이 ADMIN_ROLES 필터가 빠지면 일반 회원(member) 이 어드민 API 를 통과할 수 있음.
export async function getAdminSession(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!user.isActive) return null;
  if (!(ADMIN_ROLES as readonly string[]).includes(user.role)) return null;
  return user;
}

// 외부에서 재사용할 수 있도록 타입 노출
export type { AdminRole };
