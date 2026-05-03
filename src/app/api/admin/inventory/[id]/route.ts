import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { inventoryUpdateSchema } from "@/lib/validations/admin";
import { logAdminAction } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = inventoryUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const { id } = await params;

    const updateData: Prisma.InventoryUpdateInput = {};

    if (body.stockCount !== undefined) {
      updateData.stockCount = body.stockCount;
      updateData.status = body.stockCount === 0 ? "SOLD" : "AVAILABLE";
    }
    if (body.immediateDelivery !== undefined) {
      updateData.immediateDelivery = body.immediateDelivery;
    }
    if (body.colorExt !== undefined) {
      updateData.colorExt = body.colorExt;
    }
    if (body.selectedOptions !== undefined) {
      updateData.selectedOptions = body.selectedOptions;
    }
    if (body.memo !== undefined) {
      updateData.memo = body.memo;
    }

    if (body.financeCompanyName !== undefined) {
      if (body.financeCompanyName === "") {
        updateData.financeCompany = { disconnect: true };
      } else {
        const fc = await prisma.financeCompany.findFirst({
          where: { name: body.financeCompanyName },
          select: { id: true },
        });
        if (fc) {
          updateData.financeCompany = { connect: { id: fc.id } };
        } else {
          updateData.financeCompany = { disconnect: true };
        }
      }
    }

    if (body.trimName !== undefined) {
      const existingInv = await prisma.inventory.findUnique({
        where: { id },
        include: { trim: { include: { vehicle: { select: { slug: true } } } } },
      });
      if (!existingInv) {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
      }
      const trim = await prisma.trim.findFirst({
        where: {
          name: body.trimName,
          vehicle: { slug: existingInv.trim.vehicle.slug },
        },
        select: { id: true },
      });
      if (trim) {
        updateData.trim = { connect: { id: trim.id } };
      }
    }

    const includeShape = {
      trim: {
        include: {
          vehicle: { select: { name: true, brand: true } },
        },
      },
      financeCompany: { select: { name: true } },
    } as const;

    // 옵티미스틱 락: expectedUpdatedAt 이 있으면 updateMany 로 충돌 검사 후 재조회.
    if (body.expectedUpdatedAt) {
      const expected = new Date(body.expectedUpdatedAt);
      const result = await prisma.inventory.updateMany({
        where: { id, updatedAt: expected },
        data: updateData,
      });
      if (result.count === 0) {
        const exists = await prisma.inventory.findUnique({
          where: { id },
          select: { id: true, updatedAt: true },
        });
        if (!exists) {
          return NextResponse.json({ error: "Not Found" }, { status: 404 });
        }
        return NextResponse.json(
          {
            error: "다른 사용자가 먼저 수정했습니다. 새로고침 후 다시 시도해주세요.",
            currentUpdatedAt: exists.updatedAt.toISOString(),
          },
          { status: 409 }
        );
      }
      const updatedLocked = await prisma.inventory.findUnique({
        where: { id },
        include: includeShape,
      });
      return NextResponse.json({ success: true, data: updatedLocked });
    }

    const before = await prisma.inventory.findUnique({ where: { id } });
    const updated = await prisma.inventory.update({
      where: { id },
      data: updateData,
      include: includeShape,
    });

    await logAdminAction({
      request,
      actor: session,
      action: "INVENTORY_UPDATE",
      resource: "Inventory",
      targetId: id,
      before,
      after: updated,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PATCH /api/admin/inventory/:id]", error);
    Sentry.captureException(error, { tags: { route: "admin/inventory:PATCH" } });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const before = await prisma.inventory.findUnique({ where: { id } });
    await prisma.inventory.delete({ where: { id } });

    await logAdminAction({
      request,
      actor: session,
      action: "INVENTORY_DELETE",
      resource: "Inventory",
      targetId: id,
      before,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/admin/inventory/:id]", error);
    Sentry.captureException(error, { tags: { route: "admin/inventory:DELETE" } });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
