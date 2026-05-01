import { prisma } from "@/lib/prisma";
import { InventoryClient } from "./InventoryClient";
import { Suspense } from "react";
import type { InventoryItem, InventoryStatus } from "@/types/inventory";

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

function calcStatus(stockCount: number): InventoryStatus {
  if (stockCount === 0) return "소진";
  if (stockCount <= 2) return "부족";
  return "정상";
}

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
          vehicle: { select: { name: true, brand: true } },
        },
      },
      financeCompany: { select: { name: true } },
    },
  });

  return rows.map((inv) => ({
    id: inv.id,
    vehicleName: inv.trim.vehicle.name,
    vehicleShort: inv.trim.vehicle.name,
    brand: inv.trim.vehicle.brand,
    financeCompany: inv.financeCompany?.name ?? "",
    quantity: inv.stockCount,
    immediateDelivery: inv.immediateDelivery,
    status: calcStatus(inv.stockCount),
    registeredAt: inv.updatedAt.toISOString().slice(0, 10),
    memo: inv.memo ?? "",
    trim: inv.trim.name,
    color: inv.colorExt ?? undefined,
    options: inv.selectedOptions,
    updatedAt: inv.updatedAt.toISOString(),
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
