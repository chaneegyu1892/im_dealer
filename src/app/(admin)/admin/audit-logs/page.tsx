import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { isAdminLike } from "@/lib/admin-roles";
import { AuditLogTable } from "@/components/admin/audit-logs/AuditLogTable";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 100;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resource?: string; actor?: string }>;
}) {
  const session = await getAdminSession();
  if (!session || !isAdminLike(session.role)) redirect("/admin");

  const params = await searchParams;
  const action = params.action || undefined;
  const resource = params.resource || undefined;
  const actorId = params.actor || undefined;

  const logs = await prisma.adminAuditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(resource ? { resource } : {}),
      ...(actorId ? { actorId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: DEFAULT_LIMIT,
  });

  const serialized = logs.map((log) => ({
    id: log.id,
    actorId: log.actorId,
    actorEmail: log.actorEmail,
    action: log.action,
    resource: log.resource,
    targetId: log.targetId,
    diff: log.diff as Record<string, unknown> | null,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <AuditLogTable
      logs={serialized}
      filter={{ action, resource, actorId }}
    />
  );
}
