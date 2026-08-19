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
//
// 리스 라이프사이클 게이트: claim 이 발급한 리스가 유효한 세대에만 결과를 기록한다.
// - SENDING: 리스가 살아 있는 세대(accept 보고 전에 결과가 먼저 도착한 경쟁 창).
// - ACCEPTED: accept 가 리스를 정상 소비(접수 성공)하고 결과를 기다리는 세대.
// PENDING(재시도 대기 — 새 리스 발급 전)나 SENT/FAILED(종결) 메시지에 도착한 결과는
// 오래된 세대의 것이므로 skip 한다(멱등 no-op). 릴레이는 결과를 전 계대 공유 폴링으로
// 받고 재시작 시엔 토큰을 기억하지 못하므로, 페이로드 토큰 일치 대신 상태로 판정한다.
const RESULT_ELIGIBLE_STATUSES = ["SENDING", "ACCEPTED"] as const;

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
    let applied = 0;
    let skipped = 0;
    for (const result of parsed.data.results) {
      const delivered = result.resultCode === "1000";
      // msgIdx = AlimtalkMessage.id. resultAt:null + 리스 게이트 조건이 아니면
      // updateMany 가 0건이 되고(이미 종결됐거나 유효한 리스가 없는 세대), 멱등하게 건너뛴다.
      const updated = await prisma.alimtalkMessage.updateMany({
        where: {
          id: result.msgIdx,
          resultAt: null,
          status: { in: [...RESULT_ELIGIBLE_STATUSES] },
        },
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
      if (updated.count === 1) applied += 1;
      else skipped += 1;
    }
    return NextResponse.json({ ok: true, applied, skipped });
  } catch (e) {
    console.error("[alimtalk result]", e);
    return NextResponse.json({ error: "전송 결과 기록 실패" }, { status: 500 });
  }
}
