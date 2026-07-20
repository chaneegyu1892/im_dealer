// 견적서를 회원 본인의 카카오톡으로 전송한다.
// 흐름: 인증 → 액세스 토큰 재발급 → PNG 생성 → Storage 업로드 → 카카오 발송 → 이력 기록.
//
// 토큰 재발급 실패(리프레시 만료·연결끊기·미동의)는 409 로 구분해서 내려준다.
// 클라이언트가 이걸 보고 "다시 로그인하고 받기"를 안내한다.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { PDFQuoteData } from "@/lib/quote-pdf-template";
import { renderQuoteImageBuffer } from "@/lib/quote-image/render-quote-image";
import { buildQuoteImageData } from "@/lib/quote-image/from-request";
import { uploadQuoteImage } from "@/lib/quote-delivery/store";
import { getKakaoAccessToken } from "@/lib/kakao/token";
import { sendQuoteMemo } from "@/lib/kakao/memo";
import { strictRateLimit, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const limited = await checkRateLimit(req, strictRateLimit);
  if (limited) return limited;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: Partial<PDFQuoteData> & { savedQuoteId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  let imageData: PDFQuoteData;
  try {
    imageData = buildQuoteImageData(body, user.email ?? null);
  } catch {
    return NextResponse.json({ error: "필수 견적 정보가 누락되었습니다." }, { status: 400 });
  }

  const member = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });
  if (!member) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  // 렌더링·업로드 전에 토큰부터 확인한다 — 보낼 수 없으면 비용을 치를 이유가 없다.
  const accessToken = await getKakaoAccessToken(user.id);
  if (!accessToken) {
    return NextResponse.json(
      { error: "카카오톡 전송 권한이 만료되었습니다. 다시 로그인해 주세요.", code: "KAKAO_REAUTH_REQUIRED" },
      { status: 409 }
    );
  }

  let delivery: { id: string } | null = null;
  try {
    const png = await renderQuoteImageBuffer(imageData);
    const { path, url } = await uploadQuoteImage({ supabaseId: user.id, png });

    delivery = await prisma.quoteDelivery.create({
      data: {
        userId: member.id,
        savedQuoteId: body.savedQuoteId ?? null,
        vehicleName: imageData.vehicleName,
        imagePath: path,
        channel: "memo",
        status: "PENDING",
      },
      select: { id: true },
    });

    const result = await sendQuoteMemo({
      accessToken,
      vehicleName: imageData.vehicleName,
      imageUrl: url,
      linkUrl: quoteLinkUrl(body.savedQuoteId),
    });

    await prisma.quoteDelivery.update({
      where: { id: delivery.id },
      data: result.ok
        ? { status: "SENT", sentAt: new Date() }
        : { status: "FAILED", failReason: result.reason?.slice(0, 500) ?? "unknown" },
    });

    if (!result.ok) {
      console.error("[quote/deliver] kakao send failed:", result.reason);
      return NextResponse.json(
        { error: "카카오톡 전송에 실패했습니다. 견적서 받기로 저장해 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: { deliveryId: delivery.id } });
  } catch (err) {
    console.error("[quote/deliver] failed:", err);
    if (delivery) {
      await prisma.quoteDelivery
        .update({
          where: { id: delivery.id },
          data: { status: "FAILED", failReason: err instanceof Error ? err.message.slice(0, 500) : "unknown" },
        })
        .catch(() => undefined);
    }
    return NextResponse.json({ error: "견적서 전송에 실패했습니다." }, { status: 500 });
  }
}

function quoteLinkUrl(savedQuoteId?: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  return savedQuoteId ? `${base}/quote?sessionId=${encodeURIComponent(savedQuoteId)}` : `${base}/quote`;
}
