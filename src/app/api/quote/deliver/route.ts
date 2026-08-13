// 견적서를 회원 본인의 카카오톡으로 전송한다.
// 흐름: 인증 → 액세스 토큰 재발급 → PNG 생성 → Storage 업로드 → 카카오 발송 → 이력 기록.
//
// 토큰 재발급 실패(리프레시 만료·연결끊기·미동의)는 409 로 구분해서 내려준다.
// 클라이언트가 이걸 보고 "다시 로그인하고 받기"를 안내한다.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/require-user";
import { renderQuoteImageBuffer } from "@/lib/quote-image/render-quote-image";
import { buildOfficialDeliveryImageData } from "@/lib/quote-delivery/official-image";
import { deleteQuoteImage, uploadQuoteImage } from "@/lib/quote-delivery/store";
import { getKakaoAccessToken } from "@/lib/kakao/token";
import { sendQuoteMemo } from "@/lib/kakao/memo";
import { isKakaoSyncEnabled } from "@/lib/kakao/scopes";
import { strictRateLimit, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;
const KAKAO_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const deliveryMetadataSchema = z.object({
  savedQuoteId: z.string().trim().min(1).max(200),
  sessionId: z.string().trim().min(1).max(200),
});

export async function POST(req: NextRequest) {
  if (!isKakaoSyncEnabled()) {
    return NextResponse.json({ error: "사용할 수 없는 기능입니다." }, { status: 404 });
  }

  const limited = await checkRateLimit(req, strictRateLimit);
  if (limited) return limited;

  const { user, error: authError } = await requireActiveUser();
  if (authError) return authError;
  if (!user.supabaseId) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const metadataResult = deliveryMetadataSchema.safeParse(body);
  if (!metadataResult.success) {
    return NextResponse.json({ error: "저장된 견적 정보가 필요합니다." }, { status: 400 });
  }

  const savedQuote = await prisma.savedQuote.findFirst({
    where: {
      id: metadataResult.data.savedQuoteId,
      sessionId: metadataResult.data.sessionId,
      userId: user.supabaseId,
      deletedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      vehicleId: true,
      trimId: true,
      contractMonths: true,
      annualMileage: true,
      depositRate: true,
      prepayRate: true,
      contractType: true,
      monthlyPayment: true,
      pricingStatus: true,
      breakdown: true,
      exteriorColorId: true,
      interiorColorId: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  if (!savedQuote) {
    return NextResponse.json({ error: "전송할 견적을 확인할 수 없습니다." }, { status: 403 });
  }

  const imageResult = await buildOfficialDeliveryImageData(savedQuote);
  if (!imageResult.ok) {
    return NextResponse.json(
      { error: imageResult.error.error },
      { status: imageResult.error.status }
    );
  }
  const imageData = imageResult.data;

  const accessToken = await getKakaoAccessToken(user.supabaseId);
  if (!accessToken) {
    return NextResponse.json(
      { error: "카카오톡 전송 권한이 만료되었습니다. 다시 로그인해 주세요.", code: "KAKAO_REAUTH_REQUIRED" },
      { status: 409 }
    );
  }

  const appOrigin = getConfiguredAppOrigin();
  if (!appOrigin) {
    return NextResponse.json({ error: "견적서 전송 설정을 확인해 주세요." }, { status: 500 });
  }

  let delivery: { id: string } | null = null;
  let uploadedPath: string | null = null;
  try {
    const png = await renderQuoteImageBuffer(imageData);
    if (png.byteLength > KAKAO_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: "견적서 이미지가 전송 가능한 크기를 초과했습니다." },
        { status: 413 }
      );
    }
    const { path } = await uploadQuoteImage({ png });
    uploadedPath = path;

    delivery = await prisma.quoteDelivery.create({
      data: {
        userId: user.id,
        savedQuoteId: savedQuote.id,
        vehicleName: imageData.vehicleName,
        imagePath: path,
        channel: "memo",
        status: "PENDING",
      },
      select: { id: true },
    });

    const result = await sendQuoteMemo({
      accessToken,
      linkUrl: quoteLinkUrl(appOrigin, delivery.id),
    });

    if (!result.ok) {
      const reason = result.reason?.slice(0, 500) ?? "unknown";
      await markDeliveryFailed(delivery.id, reason);
      await removeUploadedQuote(path);
      console.error("[quote/deliver] kakao send failed:", result.reason);
      return NextResponse.json(
        { error: "카카오톡 전송에 실패했습니다. 다시 시도하거나 상담하기를 이용해 주세요." },
        { status: 502 }
      );
    }

    await markDeliverySent(delivery.id);
    return NextResponse.json({ success: true, data: { deliveryId: delivery.id } });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("[quote/deliver] failed:", error);
    if (delivery) {
      await markDeliveryFailed(delivery.id, error.message.slice(0, 500));
    }
    if (uploadedPath) await removeUploadedQuote(uploadedPath);
    return NextResponse.json({ error: "견적서 전송에 실패했습니다." }, { status: 500 });
  }
}

function getConfiguredAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
}

function quoteLinkUrl(appOrigin: string, deliveryId: string): string {
  return `${appOrigin}/quote/delivery/${encodeURIComponent(deliveryId)}`;
}

async function markDeliverySent(deliveryId: string): Promise<void> {
  try {
    await prisma.quoteDelivery.update({
      where: { id: deliveryId },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("[quote/deliver] sent status update failed:", error);
  }
}

async function markDeliveryFailed(deliveryId: string, reason: string): Promise<void> {
  try {
    await prisma.quoteDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", failReason: reason },
    });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("[quote/deliver] failed status update failed:", error);
  }
}

async function removeUploadedQuote(path: string): Promise<void> {
  try {
    await deleteQuoteImage(path);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    console.error("[quote/deliver] uploaded image cleanup failed:", error);
  }
}
