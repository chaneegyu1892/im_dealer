import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type AdminNotificationClient = Pick<Prisma.TransactionClient, "adminNotification">;

export type AdminNotificationType = "NEW_QUOTE" | "SYSTEM" | "INQUIRY" | "NEW_REVIEW";

const ALIMTALK_ENQUEUE_REASON_LABEL: Record<string, string> = {
  invalid_phone: "유효한 전화번호 없음",
  no_template_code: "템플릿 코드 없음",
  error: "적재 중 오류",
};

export function quoteAlimtalkEnqueueNoticeUrl(savedQuoteId: string): string {
  return `/admin/quotations?id=${savedQuoteId}&notice=alimtalk-enqueue`;
}

export function quoteDeliverFailedNoticeUrl(savedQuoteId: string): string {
  return `/admin/quotations?id=${savedQuoteId}&notice=deliver-failed`;
}

export function reviewSubmitNoticeUrl(reviewId: string): string {
  return `/admin/reviews?id=${reviewId}`;
}

export async function createAdminNotification({
  type,
  title,
  content,
  linkUrl,
  client = prisma,
}: {
  type: AdminNotificationType;
  title: string;
  content: string;
  linkUrl?: string;
  client?: AdminNotificationClient;
}) {
  try {
    const notification = await client.adminNotification.create({
      data: {
        type,
        title,
        content,
        linkUrl,
      },
    });
    return notification;
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error("[createAdminNotification] Failed:", cause);
    throw cause;
  }
}

/**
 * 같은 type+linkUrl 알림이 있으면 다시 만들지 않는다.
 * 알림 실패가 본 기능 응답을 바꾸면 안 되므로 예외를 삼킨다.
 */
export async function notifyAdminOnce({
  type,
  title,
  content,
  linkUrl,
  client = prisma,
}: {
  type: AdminNotificationType;
  title: string;
  content: string;
  linkUrl: string;
  client?: AdminNotificationClient;
}): Promise<void> {
  try {
    const existing = await client.adminNotification.findFirst({
      where: { type, linkUrl },
      select: { id: true },
    });
    if (existing) return;

    await client.adminNotification.create({
      data: { type, title, content, linkUrl },
    });
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error("[notifyAdminOnce] Failed:", cause);
  }
}

export async function notifyAlimtalkEnqueueFailed(params: {
  savedQuoteId: string;
  vehicleName: string;
  reason: string;
}): Promise<void> {
  const reasonLabel = ALIMTALK_ENQUEUE_REASON_LABEL[params.reason] ?? params.reason;
  await notifyAdminOnce({
    type: "SYSTEM",
    title: "알림톡 적재 실패",
    content: `${params.vehicleName} 견적 알림톡 적재를 건너뛰었습니다. 사유: ${reasonLabel}`,
    linkUrl: quoteAlimtalkEnqueueNoticeUrl(params.savedQuoteId),
  });
}

export async function notifyQuoteDeliverFailed(params: {
  savedQuoteId: string;
  vehicleName: string;
}): Promise<void> {
  await notifyAdminOnce({
    type: "SYSTEM",
    title: "견적서 전송 실패",
    content: `${params.vehicleName} 견적서 카카오톡 전송에 실패했습니다.`,
    linkUrl: quoteDeliverFailedNoticeUrl(params.savedQuoteId),
  });
}

export async function notifyReviewSubmitted(params: {
  reviewId: string;
  authorDisplayName: string;
  vehicleName: string | null;
  rating: number;
}): Promise<void> {
  const vehiclePart = params.vehicleName ? ` ${params.vehicleName}` : "";
  await notifyAdminOnce({
    type: "NEW_REVIEW",
    title: "새로운 고객 후기",
    content: `${params.authorDisplayName}이${vehiclePart} 후기를 제출했습니다. (${params.rating}점)`,
    linkUrl: reviewSubmitNoticeUrl(params.reviewId),
  });
}
