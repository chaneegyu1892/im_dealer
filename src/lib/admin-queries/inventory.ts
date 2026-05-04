import { prisma } from "../prisma";
import type { AdminInventory } from "@/types/admin";

export interface AdminInventoryItem extends AdminInventory {}

export async function getAdminInventory(): Promise<AdminInventory[]> {
  const inventory = await prisma.inventory.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      trim: {
        include: {
          vehicle: {
            select: { name: true, brand: true },
          },
        },
      },
    },
  });

  return inventory.map((i) => ({
    id: i.id,
    trimId: i.trimId,
    vehicleName: i.trim.vehicle.name,
    trimName: i.trim.name,
    stockCount: i.stockCount,
    location: i.location,
    status: i.status as AdminInventory["status"],
    colorExt: i.colorExt,
    colorInt: i.colorInt,
    vin: i.vin,
    memo: i.memo,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  }));
}
