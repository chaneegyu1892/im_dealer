import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/security";
import { notifyOpsAlert } from "@/lib/notify";

/**
 * 90일 경과 PII 자동 만료.
 *
 * 보호: Authorization: Bearer <CRON_SECRET> 일치 시에만 실행.
 * 동작: verifiedAt 이 90일 이상 지난 행의 PII 4개 컬럼을 NULL 로 비우고
 *       piiPurgedAt 에 처리 시각 기록 (감사용).
 *
 * 호출 방법:
 *   - Vercel Cron: vercel.json 의 crons 에 등록(매일 03:00). Vercel 이 GET 으로 호출하며
 *     CRON_SECRET 환경변수가 설정돼 있으면 Authorization: Bearer 헤더를 자동 주입한다.
 *   - 수동: curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/purge-pii
 *
 * 실패 시 Sentry + Slack 으로 경보(법적 보존기간 준수 의무 — 무음 실패 방지).
 */

const RETENTION_DAYS = 90;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handlePurge(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return unauthorized();

  const provided = auth.slice("Bearer ".length).trim();
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[cron/purge-pii] CRON_SECRET 환경변수가 설정되지 않았습니다.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (!timingSafeEqualString(provided, expected)) return unauthorized();

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.customerVerification.updateMany({
      where: {
        verifiedAt: { lt: cutoff },
        piiPurgedAt: null,
        OR: [
          { connectedId: { not: null } },
          { licenseData: { not: Prisma.JsonNull } },
          { insuranceData: { not: Prisma.JsonNull } },
          { bizData: { not: Prisma.JsonNull } },
        ],
      },
      data: {
        connectedId: null,
        licenseData: Prisma.JsonNull,
        insuranceData: Prisma.JsonNull,
        bizData: Prisma.JsonNull,
        piiPurgedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      purged: result.count,
      cutoff: cutoff.toISOString(),
      retentionDays: RETENTION_DAYS,
    });
  } catch (error) {
    const detail = {
      name: error instanceof Error ? error.name : "Unknown",
      message:
        error instanceof Error
          ? error.message.slice(0, 200)
          : String(error).slice(0, 200),
    };
    console.error("[cron/purge-pii]", detail);
    // 법적 보존기간 준수 의무가 있는 작업이므로 실패를 반드시 가시화한다.
    Sentry.captureException(error, { tags: { cron: "purge-pii" } });
    await notifyOpsAlert(`🚨 *PII 자동 만료 cron 실패*\n• ${detail.name}: ${detail.message}`);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}

// Vercel Cron 은 GET 으로 호출 → GET 지원. 수동 트리거를 위해 POST 도 허용.
export async function GET(request: NextRequest) {
  return handlePurge(request);
}

export async function POST(request: NextRequest) {
  return handlePurge(request);
}
