import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface HealthCheck {
  status: "ok" | "error";
  latencyMs?: number;
  error?: string;
}

export async function GET() {
  const checks: Record<string, HealthCheck> = {};
  let overall: "ok" | "degraded" = "ok";

  // Prisma / DB 체크
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (e) {
    // 비인증 공개 라우트 — 원문 에러(인프라 구성 노출) 대신 정적 코드만 응답하고
    // 상세는 서버 로그/Sentry 로 보낸다.
    console.error("[health] database check failed:", e instanceof Error ? e.message : e);
    checks.database = { status: "error", error: "db_unreachable" };
    overall = "degraded";
  }

  // Upstash Redis 체크 (선택적)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redisStart = Date.now();
    try {
      const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
    } catch (e) {
      console.error("[health] redis check failed:", e instanceof Error ? e.message : e);
      checks.redis = { status: "error", error: "redis_unreachable" };
      overall = "degraded";
    }
  }

  const httpStatus = overall === "ok" ? 200 : 503;
  return NextResponse.json(
    { status: overall, checks, timestamp: new Date().toISOString() },
    { status: httpStatus }
  );
}
