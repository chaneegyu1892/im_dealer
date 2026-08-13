import type { AdminOptionRule, AdminVehicleDetail } from "@/types/admin";
import { scraperRefsSchema } from "@/lib/validations/admin";
import { buildOptionBadgeLookup } from "@/lib/vehicle-option-badges";
import { prisma } from "../prisma";

export async function getVehicleById(id: string): Promise<AdminVehicleDetail | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      lineups: { orderBy: { createdAt: "asc" } },
      trims: {
        orderBy: [{ isDefault: "desc" }, { price: "asc" }],
        include: {
          options: {
            orderBy: [{ displayOrder: "asc" }, { price: "asc" }],
          },
          rules: true,
        },
      },
      // 차량 단위 "옵션명 → 배지" 매핑. 옵션 행에는 배지 FK가 없다.
      optionBadges: {
        select: { optionName: true, badge: { select: { id: true, label: true } } },
      },
      colors: {
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
      images: {
        orderBy: [{ type: "asc" }, { displayOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!vehicle) return null;
  const scraperRefs = scraperRefsSchema.safeParse(vehicle.scraperRefs);
  const badgeFor = buildOptionBadgeLookup(vehicle.optionBadges);

  return {
    id: vehicle.id,
    slug: vehicle.slug,
    name: vehicle.name,
    brand: vehicle.brand,
    category: vehicle.category as AdminVehicleDetail["category"],
    vehicleCode: vehicle.vehicleCode,
    basePrice: vehicle.basePrice,
    thumbnailUrl: vehicle.thumbnailUrl,
    imageUrls: vehicle.imageUrls,
    surchargeRate: vehicle.surchargeRate,
    isVisible: vehicle.isVisible,
    isPopular: vehicle.isPopular,
    isSpotlight: vehicle.isSpotlight,
    slidingDoorOverride: vehicle.slidingDoorOverride,
    advancedSafetyOverride: vehicle.advancedSafetyOverride,
    displayOrder: vehicle.displayOrder,
    tags: vehicle.tags,
    description: vehicle.description,
    scraperRefs: scraperRefs.success ? scraperRefs.data : null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    thumbnailImageId: vehicle.thumbnailImageId,
    imageRevision: vehicle.imageRevision,
    images: vehicle.images.map((image) => ({
      id: image.id,
      type: image.type,
      origin: image.origin,
      title: image.title,
      storageUrl: image.storageUrl,
      sourceUrl: image.sourceUrl,
      sourceKey: image.sourceKey,
      displayOrder: image.displayOrder,
      isVisible: image.isVisible,
      deletedAt: image.deletedAt?.toISOString() ?? null,
      createdAt: image.createdAt.toISOString(),
      updatedAt: image.updatedAt.toISOString(),
      isRepresentative: image.id === vehicle.thumbnailImageId,
    })),
    lineups: vehicle.lineups.map((lineup) => ({
      id: lineup.id,
      vehicleId: lineup.vehicleId,
      name: lineup.name,
      isVisible: lineup.isVisible,
      createdAt: lineup.createdAt.toISOString(),
      updatedAt: lineup.updatedAt.toISOString(),
    })),
    trims: vehicle.trims.map((trim) => ({
      id: trim.id,
      vehicleId: trim.vehicleId,
      lineupId: trim.lineupId,
      name: trim.name,
      price: trim.price,
      discountPrice: trim.discountPrice,
      evSubsidy: trim.evSubsidy,
      engineType: trim.engineType as AdminVehicleDetail["trims"][number]["engineType"],
      fuelEfficiency: trim.fuelEfficiency,
      isDefault: trim.isDefault,
      isVisible: trim.isVisible,
      specs: trim.specs as Record<string, string> | null,
      options: trim.options.map((option) => ({
        id: option.id,
        trimId: option.trimId,
        name: option.name,
        price: option.price,
        category: option.category,
        isDefault: option.isDefault,
        isAccessory: option.isAccessory,
        description: option.description,
        displayOrder: option.displayOrder,
        badge: badgeFor(option.name),
      })),
      rules: trim.rules.map((rule) => ({
        id: rule.id,
        trimId: rule.trimId,
        ruleType: rule.ruleType as AdminOptionRule["ruleType"],
        sourceOptionId: rule.sourceOptionId,
        targetOptionId: rule.targetOptionId,
        createdAt: rule.createdAt.toISOString(),
      })),
    })),
    colors: vehicle.colors.map((color) => ({
      id: color.id,
      vehicleId: color.vehicleId,
      kind: color.kind,
      name: color.name,
      hexCode: color.hexCode,
      imageUrl: color.imageUrl,
      priceDelta: color.priceDelta,
      isDefault: color.isDefault,
      sortOrder: color.sortOrder,
      createdAt: color.createdAt.toISOString(),
      updatedAt: color.updatedAt.toISOString(),
    })),
  };
}
