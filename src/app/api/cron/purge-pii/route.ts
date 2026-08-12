import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualString } from "@/lib/security";
import { purgeExpiredScrapeJobCredentials } from "@/lib/scraper/credential-retention";

/**
 * 인증 PII 자동 만료.
 *
 * 보호: Authorization: Bearer <CRON_SECRET> 일치 시에만 실행.
 * 동작: 성공한 인증은 완료 후 90일, 완료되지 않은 인증은 마지막 활동 후 7일이 지나면
 *       PII를 비운다. 삭제됐거나 90일 넘게 만료된 견적 연락처도 NULL 로 비운다.
 *
 * 호출 방법:
 *   - Vercel Cron: vercel.json 의 crons 에 등록(매일 03:00). Vercel 이 GET 으로 호출하며
 *     CRON_SECRET 환경변수가 설정돼 있으면 Authorization: Bearer 헤더를 자동 주입한다.
 *   - 수동: curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/purge-pii
 *
 * 실패 시 Sentry 로 경보(법적 보존기간 준수 의무 — 무음 실패 방지).
 */

const SUCCESS_RETENTION_DAYS = 90;
const INCOMPLETE_RETENTION_DAYS = 7;

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

  const successCutoff = new Date(
    Date.now() - SUCCESS_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const incompleteCutoff = new Date(
    Date.now() - INCOMPLETE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    const result = await prisma.customerVerification.updateMany({
      where: {
        verifiedAt: { lt: successCutoff },
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

    // 발급 성공 문서의 원본과 확인번호는 기존 정책대로 90일 후 파기한다.
    const docResult = await prisma.verificationDocument.updateMany({
      where: {
        issuedAt: { lt: successCutoff },
        piiPurgedAt: null,
        OR: [
          { contentEnc: { not: Prisma.JsonNull } },
          { docVerifyNo: { not: null } },
          { failReason: { not: null } },
        ],
      },
      data: {
        contentEnc: Prisma.JsonNull,
        docVerifyNo: null,
        failReason: null,
        piiPurgedAt: new Date(),
      },
    });

    // 실패·대기 문서는 마지막 활동 7일 후 행 자체를 삭제해 상태/파일 메타도 남기지 않는다.
    const incompleteDocResult = await prisma.verificationDocument.deleteMany({
      where: { issuedAt: null, updatedAt: { lt: incompleteCutoff } },
    });

    // 완료되지 않은 인증도 7일 후 행 자체를 삭제한다. 최근 문서 활동이 있으면 부모를
    // 보존해 진행 중인 간편인증을 끊지 않으며, 삭제 시 남은 문서는 FK cascade로 제거된다.
    const incompleteVerificationResult = await prisma.customerVerification.deleteMany({
      where: {
        verifiedAt: null,
        updatedAt: { lt: incompleteCutoff },
        documents: { none: { updatedAt: { gte: incompleteCutoff } } },
      },
    });

    // 삭제된 견적은 즉시, 만료된 견적은 기존 인증 PII와 같은 90일 보존기간 후
    // 고객 연락처와 로그인 전 브라우저 capability 해시를 지운다. 견적 행과 감사 로그는 남긴다.
    const quoteContactResult = await prisma.savedQuote.updateMany({
      where: {
        AND: [
          {
            OR: [
              { deletedAt: { not: null } },
              { expiresAt: { lt: successCutoff } },
            ],
          },
          {
            OR: [
              { customerName: { not: null } },
              { phone: { not: null } },
              { verificationCapabilityHash: { not: null } },
            ],
          },
        ],
      },
      data: {
        customerName: null,
        phone: null,
        verificationCapabilityHash: null,
      },
    });

    // Abandoned scraper jobs keep their audit row, but expired credentials are
    // purged once the job is no longer actively claimed.
    const scrapeCredentialResult = await purgeExpiredScrapeJobCredentials();

    return NextResponse.json({
      success: true,
      purged: result.count,
      purgedDocuments: docResult.count,
      deletedIncompleteVerifications: incompleteVerificationResult.count,
      deletedIncompleteDocuments: incompleteDocResult.count,
      purgedQuoteContacts: quoteContactResult.count,
      purgedScrapeJobCredentials: scrapeCredentialResult.count,
      successCutoff: successCutoff.toISOString(),
      incompleteCutoff: incompleteCutoff.toISOString(),
      successRetentionDays: SUCCESS_RETENTION_DAYS,
      incompleteRetentionDays: INCOMPLETE_RETENTION_DAYS,
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
