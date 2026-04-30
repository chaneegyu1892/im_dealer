import { prisma } from "@/lib/prisma";
import { InventoryClient } from "./InventoryClient";
import { Suspense } from "react";
import type { InventoryItem } from "@/types/inventory";

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

async function getInventoryItems(): Promise<InventoryItem[]> {
  const rows = await prisma.inventory.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      trim: {
        include: {
          vehicle: {
            select: {
              name: true,
              brand: true,
            },
          },
        },
      },
    },
  });

  return rows.map((item) => ({
    id: item.id,
    vehicleName: item.trim.vehicle.name,
    vehicleShort: item.trim.vehicle.name,
    brand: item.trim.vehicle.brand,
    financeCompany: "미지정",
    quantity: item.stockCount,
    immediateDelivery: item.status === "AVAILABLE" && item.stockCount > 0,
    status: item.stockCount === 0 ? "소진" : item.stockCount <= 2 ? "부족" : "정상",
    registeredAt: item.updatedAt.toISOString().slice(0, 10),
    memo: item.memo ?? "",
    trim: item.trim.name,
    color: [item.colorExt, item.colorInt].filter(Boolean).join(" / "),
    options: [],
  }));
}

async function getFinanceCompanyNames(): Promise<string[]> {
  const rows = await prisma.financeCompany.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { name: true },
  });

  return rows.map((row) => row.name);
}

export default async function AdminInventoryPage() {
  const [vehicles, initialItems, financeCompanies] = await Promise.all([
    getVehiclesForInventory(),
    getInventoryItems(),
    getFinanceCompanyNames(),
  ]);

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full bg-[#F8F9FC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#000666]"></div>
      </div>
    }>
      <InventoryClient
        vehicles={vehicles}
        initialItems={initialItems}
        financeCompanies={financeCompanies}
      />
    </Suspense>
  );
}
