import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getBestReviews } from "@/lib/admin-queries/reviews";

const querySchema = z.object({
  vehicleId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    vehicleId: searchParams.get("vehicleId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "쿼리 파라미터가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const items = await getBestReviews({
      vehicleId: parsed.data.vehicleId,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[GET /api/public/reviews/best]", error);
    return NextResponse.json(
      { error: "베스트 후기를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
