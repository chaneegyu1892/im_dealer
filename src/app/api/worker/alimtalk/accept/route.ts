import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { ALIMTALK_MAX_ATTEMPTS } from "@/lib/alimtalk/types";
import { describeCode, isRetryableResponseCode } from "@/lib/alimtalk/result-codes";

export const runtime = "nodejs";

const bodySchema = z.object({
  reports: z
    .array(
      z.object({
        id: z.string().min(1),
        leaseToken: z.string().min(1),
        responseCode: z.string().min(1).max(20),
        msg: z.string().max(500).optional(),
      })
    )
    .max(100),
});

// POST /api/worker/alimtalk/accept — 릴레이가 sendAlimTalk 접수 결과를 보고한다.
// responseCode 1000 은 "접수 성공"일 뿐 도달이 아니다. 실제 도달은 result 라우트에서 확정된다.
export async function POST(request: NextRequest) {
  const { error } = requireWorker(request, "ALIMTALK_RELAY_SECRET");
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  try {
    const now = new Date();
    for (const report of parsed.data.reports) {
      const accepted = report.responseCode === "1000";
      // 재시도 대상이어도 시도 횟수를 다 썼으면 더 보내지 않는다.
      const retry =
        !accepted &&
        isRetryableResponseCode(report.responseCode) &&
        (await hasAttemptsLeft(report.id));

      await prisma.alimtalkMessage.updateMany({
        // leaseToken 조건: 리스가 회수된 뒤 늦게 도착한 보고를 무시한다
        where: { id: report.id, leaseToken: report.leaseToken },
        data: accepted
          ? {
              status: "ACCEPTED",
              responseCode: report.responseCode,
              sentAt: now,
              leaseToken: null,
            }
          : {
              status: retry ? "PENDING" : "FAILED",
              responseCode: report.responseCode,
              failReason: describeCode(report.responseCode, report.msg),
              leaseToken: null,
            },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[alimtalk accept]", e);
    return NextResponse.json({ error: "접수 결과 기록 실패" }, { status: 500 });
  }
}

async function hasAttemptsLeft(id: string): Promise<boolean> {
  const row = await prisma.alimtalkMessage.findUnique({
    where: { id },
    select: { attempts: true },
  });
  return (row?.attempts ?? ALIMTALK_MAX_ATTEMPTS) < ALIMTALK_MAX_ATTEMPTS;
}
