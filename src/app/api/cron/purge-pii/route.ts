import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/security";

/**
 * 90일 경과 PII 자동 만료.
 *
 * 보호: Authorization: Bearer <CRON_SECRET> 일치 시에만 실행.
 * 동작: verifiedAt 이 90일 이상 지난 행의 PII 4개 컬럼을 NULL 로 비우고
 *       piiPurgedAt 에 처리 시각 기록 (감사용).
 *
 * 호출 방법:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/purge-pii
 *
 * 본 라우트는 엔드포인트만 제공. 실제 일정 호출은 외부 cron(Vercel Cron, GitHub
 * Actions schedule, Upstash QStash 등) 에서 매일 1회 호출.
 */

const RETENTION_DAYS = 90;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: NextRequest) {
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
    console.error("[cron/purge-pii]", {
      name: error instanceof Error ? error.name : "Unknown",
      message:
        error instanceof Error
          ? error.message.slice(0, 200)
          : String(error).slice(0, 200),
    });
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}

