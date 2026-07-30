import { NextResponse } from "next/server";
import type { User } from "@prisma/client";
import { getCurrentUser } from "@/lib/admin-auth";

export type ActiveUserRequirement =
  | { user: User; error: null }
  | { user: null; error: NextResponse };

export async function getActiveUser(): Promise<User | null> {
  const user = await getCurrentUser();
  return user?.isActive ? user : null;
}

export async function requireActiveUser(): Promise<ActiveUserRequirement> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }
  if (!user.isActive) {
    return {
      user: null,
      error: NextResponse.json({ error: "비활성화된 계정입니다." }, { status: 403 }),
    };
  }
  return { user, error: null };
}
