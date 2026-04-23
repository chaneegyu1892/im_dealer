import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";

export async function requireAdmin() {
  const admin = await getAdminSession();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  return { admin, error: null };
}

export async function requireSuperAdmin() {
  const admin = await getAdminSession();
  if (!admin) {
    return { admin: null, error: NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 }) };
  }
  if (admin.role !== "admin") {
    return { admin: null, error: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }) };
  }
  return { admin, error: null };
}
