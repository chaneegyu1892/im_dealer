import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { listPublicReviews } from "@/lib/admin-queries/reviews";
import type { ReviewSort } from "@/types/review";

const querySchema = z.object({
  vehicleId: z.string().optional(),
  brand: z.string().optional(),
  ratings: z.string().optional(),
  withImages: z.enum(["1", "true"]).optional(),
  sort: z.enum(["recent", "rating", "popular"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(24).optional(),
});

function parseRatings(raw: string | undefined): number[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
    )
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    vehicleId: searchParams.get("vehicleId") ?? undefined,
    brand: searchParams.get("brand") ?? undefined,
    ratings: searchParams.get("ratings") ?? undefined,
    withImages: searchParams.get("withImages") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "쿼리 파라미터가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const result = await listPublicReviews({
      vehicleId: parsed.data.vehicleId,
      brand: parsed.data.brand,
      ratings: parseRatings(parsed.data.ratings),
      withImages: Boolean(parsed.data.withImages),
      sort: parsed.data.sort as ReviewSort | undefined,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/public/reviews]", error);
    return NextResponse.json(
      { error: "후기 목록을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
