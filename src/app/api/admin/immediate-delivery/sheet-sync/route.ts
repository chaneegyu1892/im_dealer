import { NextResponse, type NextRequest } from "next/server";
import { logAdminAction } from "@/lib/audit";
import { requireRoleAtLeast } from "@/lib/require-admin";
import { IMMEDIATE_DELIVERY_BRANDS, type ImmediateDeliveryBrand } from "@/lib/immediate-delivery";
import { attemptBrandSheetSync, sheetSyncConfig } from "@/lib/immediate-delivery/sheets-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/admin/immediate-delivery/sheet-sync — 구글 시트 수동 동기화.
// body { brand?: string } — 없으면 전체 브랜드 동기화.
export async function POST(request: NextRequest) {
  const { admin, error } = await requireRoleAtLeast("staff");
  if (error) return error;

  try {
    if (!sheetSyncConfig()) {
      return NextResponse.json(
        { error: "구글 시트 동기화 환경변수(GOOGLE_SHEETS_CLIENT_EMAIL/PRIVATE_KEY, IMMEDIATE_DELIVERY_SHEET_ID)가 설정되지 않았습니다." },
        { status: 400 },
      );
    }
    const body = (await request.json().catch(() => ({}))) as { brand?: string };
    const brands: ImmediateDeliveryBrand[] = body.brand
      ? (IMMEDIATE_DELIVERY_BRANDS as readonly string[]).includes(body.brand)
        ? [body.brand as ImmediateDeliveryBrand]
        : []
      : [...IMMEDIATE_DELIVERY_BRANDS];
    if (brands.length === 0) {
      return NextResponse.json({ error: "지원하지 않는 브랜드입니다." }, { status: 400 });
    }

    const results: Record<string, { status: string; error?: string }> = {};
    for (const brand of brands) {
      results[brand] = await attemptBrandSheetSync(brand);
    }

    await logAdminAction({
      request,
      actor: admin,
      action: "IMMEDIATE_DELIVERY_SHEET_SYNC",
      resource: "ImmediateDeliveryBatch",
      meta: { results },
    });

    const failed = Object.entries(results).filter(([, r]) => r.status === "failed");
    return NextResponse.json({ success: failed.length === 0, results });
  } catch (e) {
    console.error("[immediate-delivery sheet-sync POST]", e);
    return NextResponse.json({ error: "시트 동기화 실패" }, { status: 500 });
  }
}
