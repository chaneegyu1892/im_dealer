import * as Sentry from "@sentry/nextjs";
import type { NextRequest } from "next/server";
import type { User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "VEHICLE_CREATE"
  | "VEHICLE_UPDATE"
  | "VEHICLE_DELETE"
  | "TRIM_CREATE"
  | "TRIM_UPDATE"
  | "TRIM_DELETE"
  | "OPTION_CREATE"
  | "OPTION_UPDATE"
  | "OPTION_DELETE"
  | "VEHICLE_COLOR_CREATE"
  | "VEHICLE_COLOR_UPDATE"
  | "VEHICLE_COLOR_DELETE"
  | "REVIEW_CREATE"
  | "REVIEW_UPDATE"
  | "REVIEW_DELETE"
  | "REVIEW_TOKEN_ISSUE"
  | "REVIEW_TOKEN_REVOKE"
  | "RATE_SHEET_CREATE"
  | "RATE_SHEET_UPDATE"
  | "RATE_SHEET_DELETE"
  | "FINANCE_COMPANY_CREATE"
  | "FINANCE_COMPANY_UPDATE"
  | "FINANCE_COMPANY_DELETE"
  | "INVENTORY_CREATE"
  | "INVENTORY_UPDATE"
  | "INVENTORY_DELETE"
  | "QUOTE_UPDATE"
  | "QUOTE_DELETE"
  | "BRAND_UPDATE"
  | "ACCOUNT_CREATE"
  | "ACCOUNT_UPDATE"
  | "ACCOUNT_DELETE"
  | "POLICY_UPDATE"
  | "AI_CONFIG_UPDATE"
  | "POPULAR_CONFIG_CREATE"
  | "POPULAR_CONFIG_UPDATE"
  | "POPULAR_CONFIG_DELETE"
  | "LINEUP_CREATE"
  | "LINEUP_UPDATE"
  | "LINEUP_DELETE"
  | "RULE_CREATE"
  | "RULE_UPDATE"
  | "RULE_DELETE"
  | "NOTIFICATION_CREATE"
  | "NOTIFICATION_UPDATE"
  | "NOTIFICATION_DELETE";

export type AuditActor = Pick<User, "id"> & { email: string | null };

interface LogAdminActionParams {
  request?: NextRequest | Request | null;
  actor: AuditActor;
  action: AuditAction;
  resource: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
}

function extractIp(request?: NextRequest | Request | null): string | null {
  if (!request) return null;
  const trustProxy = process.env.TRUST_PROXY === "true";
  if (trustProxy) {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
    const xreal = request.headers.get("x-real-ip");
    if (xreal) return xreal.trim();
  }
  const directIp = (request as unknown as { ip?: string }).ip;
  return directIp ?? null;
}

function extractUserAgent(request?: NextRequest | Request | null): string | null {
  if (!request) return null;
  return request.headers.get("user-agent");
}

function buildDiff(
  before: unknown,
  after: unknown,
  meta: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  const payload: Record<string, unknown> = {};
  if (before !== undefined) payload.before = before;
  if (after !== undefined) payload.after = after;
  if (meta && Object.keys(meta).length > 0) payload.meta = meta;
  return Object.keys(payload).length > 0 ? payload : null;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const { request, actor, action, resource, targetId, before, after, meta } = params;

  try {
    const diffPayload = buildDiff(before, after, meta);
    await prisma.adminAuditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email ?? "",
        action,
        resource,
        targetId: targetId ?? null,
        diff: diffPayload
          ? (diffPayload as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        ip: extractIp(request),
        userAgent: extractUserAgent(request)?.slice(0, 500) ?? null,
      },
    });
  } catch (error) {
    // 감사 로그 적재 실패는 호출자의 mutation을 차단해서는 안 된다.
    // 실패 자체는 Sentry로만 보고하고 무음 처리한다.
    Sentry.captureException(error, {
      tags: { component: "audit-log" },
      extra: { action, resource, targetId },
    });
    console.error("[audit] logAdminAction failed:", error);
  }
}
