import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type AdminNotificationClient = Pick<Prisma.TransactionClient, "adminNotification">;

export async function createAdminNotification({
  type,
  title,
  content,
  linkUrl,
  client = prisma,
}: {
  type: "NEW_QUOTE" | "SYSTEM" | "INQUIRY";
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
