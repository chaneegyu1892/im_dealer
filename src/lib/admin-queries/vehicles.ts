import { prisma } from "../prisma";
import type {
  AdminVehicle,
  AdminVehicleDetail,
  AdminBrand,
  AdminOptionRule,
} from "@/types/admin";

export async function getAdminVehicles(brand?: string): Promise<AdminVehicle[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: brand ? { brand } : undefined,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { trims: true } } },
  });

  return vehicles.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    category: v.category as AdminVehicle["category"],
    vehicleCode: v.vehicleCode,
    basePrice: v.basePrice,
    thumbnailUrl: v.thumbnailUrl,
    imageUrls: v.imageUrls,
    surchargeRate: v.surchargeRate,
    isVisible: v.isVisible,
    isPopular: v.isPopular,
    displayOrder: v.displayOrder,
    description: v.description,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    _count: v._count,
  }));
}

export async function getVehicleById(id: string): Promise<AdminVehicleDetail | null> {
  const v = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      lineups: {
        orderBy: { createdAt: "asc" },
      },
      trims: {
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        include: {
          options: { orderBy: { price: "asc" } },
          rules: true,
        },
      },
    },
  });

  if (!v) return null;

  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    category: v.category as AdminVehicleDetail["category"],
    vehicleCode: v.vehicleCode,
    basePrice: v.basePrice,
    thumbnailUrl: v.thumbnailUrl,
    imageUrls: v.imageUrls,
    surchargeRate: v.surchargeRate,
    isVisible: v.isVisible,
    isPopular: v.isPopular,
    displayOrder: v.displayOrder,
    description: v.description,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    lineups: v.lineups.map((l) => ({
      id: l.id,
      vehicleId: l.vehicleId,
      name: l.name,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    })),
    trims: v.trims.map((t) => ({
      id: t.id,
      vehicleId: t.vehicleId,
      lineupId: t.lineupId,
      name: t.name,
      price: t.price,
      engineType: t.engineType as AdminVehicleDetail["trims"][number]["engineType"],
      fuelEfficiency: t.fuelEfficiency,
      isDefault: t.isDefault,
      isVisible: t.isVisible,
      specs: t.specs as Record<string, string> | null,
      options: t.options.map((o) => ({
        id: o.id,
        trimId: o.trimId,
        name: o.name,
        price: o.price,
        category: o.category,
        isDefault: o.isDefault,
        isAccessory: o.isAccessory,
        description: o.description,
      })),
      rules: t.rules.map((r) => ({
        id: r.id,
        trimId: r.trimId,
        ruleType: r.ruleType as AdminOptionRule["ruleType"],
        sourceOptionId: r.sourceOptionId,
        targetOptionId: r.targetOptionId,
        createdAt: r.createdAt.toISOString(),
      })),
    })),
  };
}

export async function getAdminBrands(): Promise<AdminBrand[]> {
  const groups = await prisma.vehicle.groupBy({
    by: ["brand"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return groups.map((g) => ({
    name: g.brand,
    vehicleCount: g._count.id,
  }));
}
