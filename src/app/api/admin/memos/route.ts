import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminLike } from "@/lib/require-admin";

const MEMO_CATEGORIES = ["이슈/긴급", "공지사항", "일반", "업무/인수인계"] as const;

// ─── GET /api/admin/memos ───────────────────────────────
// 운영 메모 목록 조회 (vehicleId가 null인 OperationalNote)
export async function GET() {
  const { admin, error } = await requireAdminLike();
  if (error) return error;

  try {
    const memos = await prisma.operationalNote.findMany({
      where: { vehicleId: null },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: memos });
  } catch (err) {
    console.error("[GET /api/admin/memos]", err);
    return NextResponse.json(
      { error: "메모 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: z.enum(MEMO_CATEGORIES),
  isPinned: z.boolean().default(false),
});

// ─── POST /api/admin/memos ──────────────────────────────
export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdminLike();
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const memo = await prisma.operationalNote.create({
      data: {
        vehicleId: null,
        category: parsed.data.category,
        title: parsed.data.title,
        content: parsed.data.content,
        isPinned: parsed.data.isPinned,
        createdBy: admin.name,
      },
    });

    return NextResponse.json({ success: true, data: memo }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/memos]", err);
    return NextResponse.json(
      { error: "메모 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
