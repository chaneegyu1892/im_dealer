import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAtLeast, requireSuperAdmin } from "@/lib/require-admin";
import { logAdminAction } from "@/lib/audit";
import { encryptString } from "@/lib/pii";
import { scraperCredentialUpsertSchema } from "@/lib/validations/admin";

// GET /api/admin/scraper-credentials?financeCompanyId=...
// 존재 여부와 비민감 메타만 반환 — 암호문/평문은 절대 노출하지 않는다.
export async function GET(request: NextRequest) {
  const { error } = await requireRoleAtLeast("admin");
  if (error) return error;

  const financeCompanyId = new URL(request.url).searchParams.get("financeCompanyId");
  if (!financeCompanyId) {
    return NextResponse.json({ error: "financeCompanyId가 필요합니다." }, { status: 400 });
  }

  try {
    const cred = await (prisma as any).capitalScraperCredential.findUnique({
      where: { financeCompanyId },
      select: { loginUrl: true, requiresHuman: true, isActive: true, updatedAt: true },
    });
    return NextResponse.json({
      success: true,
      exists: !!cred,
      ...(cred
        ? {
            loginUrl: cred.loginUrl,
            requiresHuman: cred.requiresHuman,
            isActive: cred.isActive,
            updatedAt: cred.updatedAt.toISOString(),
          }
        : {}),
    });
  } catch (e) {
    console.error("[scraper-credentials GET]", e);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

// PUT /api/admin/scraper-credentials — 자격증명 등록/수정 (superadmin 전용)
// 평문 ID/PW 는 즉시 암호화되어 저장되며, 서버는 평문을 보관·로깅하지 않는다.
export async function PUT(request: NextRequest) {
  const { admin: session, error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const input = scraperCredentialUpsertSchema.parse(await request.json());
    const db = prisma as any;

    const usernameEnc = encryptString(input.username);
    const passwordEnc = encryptString(input.password);

    await db.capitalScraperCredential.upsert({
      where: { financeCompanyId: input.financeCompanyId },
      create: {
        financeCompanyId: input.financeCompanyId,
        loginUrl: input.loginUrl,
        usernameEnc,
        passwordEnc,
        requiresHuman: input.requiresHuman,
        config: input.config ?? undefined,
      },
      update: {
        loginUrl: input.loginUrl,
        usernameEnc,
        passwordEnc,
        requiresHuman: input.requiresHuman,
        config: input.config ?? undefined,
        isActive: true,
      },
    });

    await logAdminAction({
      request,
      actor: session,
      action: "SCRAPER_CRED_UPSERT",
      resource: "CapitalScraperCredential",
      targetId: input.financeCompanyId,
      // 비밀값은 meta 에 절대 기록하지 않음
      meta: { financeCompanyId: input.financeCompanyId, requiresHuman: input.requiresHuman },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[scraper-credentials PUT]", e);
    return NextResponse.json({ error: "저장 실패" }, { status: 500 });
  }
}
