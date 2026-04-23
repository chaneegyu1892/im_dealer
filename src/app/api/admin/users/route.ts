import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

function computeStatus(lastSignInAt: string | null, bannedUntil: string | null): "정상" | "휴면" | "탈퇴" {
  if (bannedUntil && new Date(bannedUntil) > new Date()) return "탈퇴";
  if (!lastSignInAt) return "휴면";
  const daysSince = (Date.now() - new Date(lastSignInAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 90) return "휴면";
  return "정상";
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const client = supabaseAdmin();
    const { data, error } = await client.auth.admin.listUsers({ perPage: 1000 });

    if (error) {
      console.error("[GET /api/admin/users] Supabase error:", error);
      return NextResponse.json({ error: "사용자 목록을 불러올 수 없습니다." }, { status: 500 });
    }

    const userIds = data.users.map((u) => u.id);

    // 각 유저의 저장 견적 수 및 최근 견적 조회
    const savedQuotes = await prisma.savedQuote.findMany({
      where: { userId: { in: userIds } },
      select: {
        id: true,
        userId: true,
        vehicleId: true,
        monthlyPayment: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // vehicleId → name 매핑
    const vehicleIds = [...new Set(savedQuotes.map((q) => q.vehicleId))];
    const vehicles = await prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true },
    });
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v.name]));

    // userId별 견적 집계
    const quotesByUser = new Map<string, typeof savedQuotes>();
    for (const q of savedQuotes) {
      if (!q.userId) continue;
      const arr = quotesByUser.get(q.userId) ?? [];
      arr.push(q);
      quotesByUser.set(q.userId, arr);
    }

    const users = data.users.map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      const name = meta.full_name ?? meta.name ?? u.email?.split("@")[0] ?? "사용자";
      const userQuotes = quotesByUser.get(u.id) ?? [];

      const activeItems = userQuotes.slice(0, 3).map((q) => ({
        quoteId: q.id,
        vehicleName: vehicleMap.get(q.vehicleId) ?? "알 수 없는 차량",
        status: "상담대기" as const,
      }));

      return {
        id: u.id,
        name,
        phone: u.phone ?? meta.phone ?? "-",
        email: u.email ?? "",
        joinedAt: u.created_at?.split("T")[0] ?? "",
        lastLoginAt: u.last_sign_in_at?.split("T")[0] ?? "",
        status: computeStatus(u.last_sign_in_at ?? null, u.banned_until ?? null),
        quoteViewCount: userQuotes.length,
        consultationCount: 0,
        pdfDownloadCount: 0,
        activeItems,
        memo: "",
      };
    });

    const total = users.length;
    const active = users.filter((u) => u.status === "정상").length;
    const dormant = users.filter((u) => u.status === "휴면").length;
    const withdrawn = users.filter((u) => u.status === "탈퇴").length;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newThisMonth = users.filter((u) => u.joinedAt && new Date(u.joinedAt) >= oneMonthAgo).length;

    return NextResponse.json({
      success: true,
      data: { users, stats: { total, active, dormant, withdrawn, newThisMonth } },
    });
  } catch (e) {
    console.error("[GET /api/admin/users]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
