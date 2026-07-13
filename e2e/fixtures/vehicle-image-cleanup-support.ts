import type { Prisma, PrismaClient } from "@prisma/client";

export type VehicleImageCleanupReceipt = {
  readonly prefix: string;
  readonly vehicleId: string;
  readonly adminId: string;
  readonly auditActorId: string;
  readonly auditTargetIds: readonly string[];
  readonly storagePaths: readonly string[];
};

export type CleanupOwnership = {
  readonly auditTargetIds: readonly string[];
  readonly storagePaths: readonly string[];
};

type AuditClient = Pick<PrismaClient, "adminAuditLog">;
type AuditOwnership = Pick<VehicleImageCleanupReceipt, "auditActorId" | "auditTargetIds">;

export function vehicleImageAuditWhere(
  ownership: AuditOwnership,
  action?: string,
): Prisma.AdminAuditLogWhereInput {
  return {
    actorId: ownership.auditActorId,
    action: action ?? { startsWith: "VEHICLE_IMAGE_" },
    resource: "VehicleImage",
    targetId: { in: [...ownership.auditTargetIds] },
  };
}

export async function countOwnedVehicleImageAuditLogs(
  client: AuditClient,
  ownership: AuditOwnership,
  action?: string,
): Promise<number> {
  return client.adminAuditLog.count({ where: vehicleImageAuditWhere(ownership, action) });
}

export async function deleteOwnedVehicleImageAuditLogs(
  client: AuditClient,
  ownership: AuditOwnership,
): Promise<void> {
  if (ownership.auditTargetIds.length === 0) return;
  await client.adminAuditLog.deleteMany({ where: vehicleImageAuditWhere(ownership) });
}
