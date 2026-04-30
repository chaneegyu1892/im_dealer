import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { inventoryCreateSchema } from "@/lib/validations/admin";
import type { InventoryItem, InventoryStatus } from "@/types/inventory";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function calcStatus(stockCount: number): InventoryStatus {
  if (stockCount === 0) return "소진";
  if (stockCount <= 2) return "부족";
  return "정상";
}

function mapToInventoryItem(inv: {
  id: string;
  stockCount: number;
  immediateDelivery: boolean;
  colorExt: string | null;
  memo: string | null;
  selectedOptions: string[];
  updatedAt: Date;
  trim: {
    name: string;
    vehicle: {
      name: string;
      brand: string;
    };
  };
  financeCompany: { name: string } | null;
}): InventoryItem {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const sizeRaw = Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = Math.min(
      Math.max(Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

    const [total, inventories] = await Promise.all([
      prisma.inventory.count(),
      prisma.inventory.findMany({
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          trim: {
            include: {
              vehicle: {
                select: { name: true, brand: true },
              },
            },
          },
          financeCompany: {
            select: { name: true },
          },
        },
      }),
    ]);

    const data: InventoryItem[] = inventories.map(mapToInventoryItem);

    return NextResponse.json({
      success: true,
      data,
      meta: { total, page, limit: pageSize },
    });
  } catch (error) {
    console.error("[GET /api/admin/inventory]", error);
    Sentry.captureException(error, { tags: { route: "admin/inventory:GET" } });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = inventoryCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { vehicleSlug, trimName, financeCompanyName, stockCount, immediateDelivery, colorExt, selectedOptions, memo } = parsed.data;

    // Look up trim by name + vehicle slug
    const trim = await prisma.trim.findFirst({
      where: {
        name: trimName,
        vehicle: { slug: vehicleSlug },
      },
      include: {
        vehicle: { select: { name: true, brand: true } },
      },
    });

    if (!trim) {
      return NextResponse.json({ error: "Trim not found" }, { status: 404 });
    }

    // Look up financeCompanyId if name provided
    let financeCompanyId: string | null = null;
    if (financeCompanyName) {
      const fc = await prisma.financeCompany.findFirst({
        where: { name: financeCompanyName },
      });
      financeCompanyId = fc?.id ?? null;
    }

    const inventory = await prisma.inventory.create({
      data: {
        trimId: trim.id,
        stockCount,
        immediateDelivery,
        colorExt: colorExt ?? null,
        selectedOptions: selectedOptions ?? [],
        memo: memo ?? null,
        financeCompanyId,
        status: stockCount === 0 ? "SOLD" : "AVAILABLE",
      },
      include: {
        trim: {
          include: {
            vehicle: { select: { name: true, brand: true } },
          },
        },
        financeCompany: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, data: mapToInventoryItem(inventory) }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/inventory]", error);
    Sentry.captureException(error, { tags: { route: "admin/inventory:POST" } });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
