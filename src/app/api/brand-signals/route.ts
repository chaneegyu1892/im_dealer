import { NextResponse } from "next/server";
import { getBrandSignals } from "@/lib/brand-signals";

// 공개 정렬 신호. 인증 불필요. 브랜드 정보는 공개 데이터다.
// 정렬에 필요한 isFeatured + vehicleCount 만 전달한다.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const map = await getBrandSignals();
    const data = Object.fromEntries(map);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[GET /api/brand-signals]", error);
    return NextResponse.json(
      { error: "브랜드 정렬 신호를 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
