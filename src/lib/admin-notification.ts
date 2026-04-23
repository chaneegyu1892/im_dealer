import { prisma } from "./prisma";

export async function createAdminNotification({
  type,
  title,
  content,
  linkUrl,
}: {
  type: "NEW_QUOTE" | "SYSTEM" | "INQUIRY";
  title: string;
  content: string;
  linkUrl?: string;
}) {
  try {
    const notification = await prisma.adminNotification.create({
      data: {
        type,
        title,
        content,
        linkUrl,
      },
    });
    return notification;
  } catch (error) {
    console.error("[createAdminNotification] Failed:", error);
    return null;
  }
}
