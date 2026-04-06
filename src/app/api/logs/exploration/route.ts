import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashIp, getClientIp } from "@/lib/ip-hash";

// ─── 이벤트 타입 ────────────────────────────────────────
const EVENT_TYPES = [
  "page_view",          // 페이지 진입
  "car_click",          // 차량 카드 클릭
  "filter_apply",       // 필터 적용
  "quote_start",        // 견적 시뮬레이터 조작 시작
  "quote_complete",     // 견적 조건 확정 (시나리오 탭 클릭)
  "chat_click",         // 채널톡 버튼 클릭
  "recommend_start",    // AI 추천 플로우 진입
  "recommend_complete", // AI 추천 결과 확인
] as const;

// ─── 스키마 ─────────────────────────────────────────────
const explorationSchema = z.object({
  sessionId: z.string().min(1),
  eventType: z.enum(EVENT_TYPES),
  path: z.string().optional(),
  vehicleId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── POST /api/logs/exploration ──────────────────────────
// 클라이언트에서 탐색 이벤트 수집
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = explorationSchema.parse(body);

    const ip = getClientIp(request);
    const ipHash = hashIp(ip);
    const userAgent = request.headers.get("user-agent") ?? undefined;

    await prisma.explorationLog.create({
      data: {
        sessionId: data.sessionId,
        eventType: data.eventType,
        path: data.path,
        vehicleId: data.vehicleId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (data.metadata ?? {}) as any,
        userAgent,
        ipHash,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: error.flatten() },
        { status: 400 }
      );
    }
    // 로그 저장 실패는 사용자 경험에 영향을 주지 않도록 조용히 처리
    console.error("[POST /api/logs/exploration]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ─── GET /api/logs/exploration ───────────────────────────
// 관리자용 탐색 로그 조회
// Query params: eventType, vehicleId, from, to, page, limit
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const eventType = searchParams.get("eventType") ?? undefined;
    const vehicleId = searchParams.get("vehicleId") ?? undefined;
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));
    const skip = (page - 1) * limit;

    const where = {
      ...(eventType && { eventType }),
      ...(vehicleId && { vehicleId }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.explorationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          vehicle: {
            select: { name: true, brand: true, slug: true },
          },
        },
      }),
      prisma.explorationLog.count({ where }),
    ]);

    // 이벤트 타입별 집계 (현재 필터 기준)
    const eventCounts = await prisma.explorationLog.groupBy({
      by: ["eventType"],
      where: {
        ...(from || to
          ? {
              createdAt: {
                ...(from && { gte: from }),
                ...(to && { lte: to }),
              },
            }
          : {}),
      },
      _count: { eventType: true },
      orderBy: { _count: { eventType: "desc" } },
    });

    return NextResponse.json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        eventCounts: Object.fromEntries(
          eventCounts.map((e) => [e.eventType, e._count.eventType])
        ),
      },
    });
  } catch (error) {
    console.error("[GET /api/logs/exploration]", error);
    return NextResponse.json(
      { error: "로그 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
