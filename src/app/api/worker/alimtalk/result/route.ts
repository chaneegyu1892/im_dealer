import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/worker-auth";
import { describeCode } from "@/lib/alimtalk/result-codes";

export const runtime = "nodejs";

const bodySchema = z.object({
  results: z
    .array(
      z.object({
        msgIdx: z.string().min(1),
        resultCode: z.string().min(1).max(20),
        sendType: z.string().max(4).optional(),
        uid: z.string().max(100).optional(),
      })
    )
    .max(500), // getResultPoll 1회 최대 500건
});

// POST /api/worker/alimtalk/result — 릴레이가 getResultPoll 로 받은 전송 결과를 보고한다.
// 릴레이는 이 응답이 성공한 뒤에만 ackResultPoll 을 호출한다.
// 여기서 실패하면 ack 되지 않아 다음 폴링에 같은 결과가 다시 오므로, 결과가 유실되지 않는다.
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
    for (const result of parsed.data.results) {
      const delivered = result.resultCode === "1000";
      // msgIdx = AlimtalkMessage.id. 이미 결과가 기록된 행은 건드리지 않는다
      // (ack 실패로 같은 결과를 다시 받아도 멱등).
      await prisma.alimtalkMessage.updateMany({
        where: { id: result.msgIdx, resultAt: null },
        data: {
          status: delivered ? "SENT" : "FAILED",
          resultCode: result.resultCode,
          sendType: result.sendType ?? null,
          uid: result.uid ?? null,
          failReason: delivered ? null : describeCode(result.resultCode),
          resultAt: now,
          leaseToken: null,
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[alimtalk result]", e);
    return NextResponse.json({ error: "전송 결과 기록 실패" }, { status: 500 });
  }
}
