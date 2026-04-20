'use client';

import { prisma } from "@/lib/prisma";
import { InventoryClient } from "./InventoryClient";

export type VehicleTrimOption = {
  id: string;
  name: string;
  category: string | null;
};

export type VehicleTrim = {
  id: string;
  name: string;
  engineType: string;
  isDefault: boolean;
  options: VehicleTrimOption[];
};

export type VehicleForInventory = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  thumbnailUrl: string;
  imageUrls: string[];
  trims: VehicleTrim[];
};

async function getVehiclesForInventory(): Promise<VehicleForInventory[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { isVisible: true },
    orderBy: [{ brand: "asc" }, { displayOrder: "asc" }],
    include: {
      trims: {
        where: { isVisible: true },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        include: {
          options: {
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  return vehicles.map((v) => ({
    id: v.id,
    slug: v.slug,
    name: v.name,
    brand: v.brand,
    thumbnailUrl: v.thumbnailUrl,
    imageUrls: v.imageUrls,
    trims: v.trims.map((t) => ({
      id: t.id,
      name: t.name,
      engineType: t.engineType,
      isDefault: t.isDefault,
      options: t.options.map((o) => ({
        id: o.id,
        name: o.name,
        category: o.category,
      })),
    })),
  }));
}

import { Suspense } from "react";

export default async function AdminInventoryPage() {
  const vehicles = await getVehiclesForInventory();

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-[#F8F9FC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000666]"></div>
      </div>
    }>
      <InventoryClient vehicles={vehicles} />
    </Suspense>
  );
}
