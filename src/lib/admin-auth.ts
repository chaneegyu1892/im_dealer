import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { AdminUser } from "@prisma/client";

const COOKIE_NAME = "admin_token";
const JWT_ALG = "HS256";

function getSecret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s) throw new Error("ADMIN_JWT_SECRET 환경변수가 설정되지 않았습니다.");
  return new TextEncoder().encode(s);
}

// ── JWT 발급 ──────────────────────────────────────────────
export async function createAdminToken(adminId: string): Promise<string> {
  return new SignJWT({ sub: adminId })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

// ── JWT 검증 ──────────────────────────────────────────────
async function verifyAdminToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [JWT_ALG] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// ── 쿠키에서 세션 읽기 ────────────────────────────────────
export async function getAdminSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const adminId = await verifyAdminToken(token);
  if (!adminId) return null;

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isActive) return null;

  return admin;
}

// ── 비밀번호 해시 생성 (시드용) ───────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ── 비밀번호 검증 ─────────────────────────────────────────
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ── 쿠키 설정값 ───────────────────────────────────────────
export const ADMIN_COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8시간
};
