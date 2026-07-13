import type { VehicleImage } from "@prisma/client";
import { NextResponse } from "next/server";

type ImageLike = Pick<VehicleImage,
  "id" | "vehicleId" | "type" | "origin" | "title" | "storageUrl" | "sourceUrl" | "sourceKey"
  | "displayOrder" | "isVisible" | "deletedAt" | "createdAt" | "updatedAt"
>;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function imageResponse(image: ImageLike) {
  return {
    id: image.id,
    vehicleId: image.vehicleId,
    type: image.type,
    origin: image.origin,
    title: image.title,
    storageUrl: image.storageUrl,
    sourceUrl: image.sourceUrl,
    sourceKey: image.sourceKey,
    displayOrder: image.displayOrder,
    isVisible: image.isVisible,
    deletedAt: image.deletedAt instanceof Date ? image.deletedAt.toISOString() : image.deletedAt,
    createdAt: iso(image.createdAt),
    updatedAt: iso(image.updatedAt),
  };
}

function hasHttpStatus(error: unknown): error is Error & { readonly status: number; readonly code?: string } {
  return error instanceof Error
    && "status" in error
    && typeof error.status === "number"
    && (!("code" in error) || typeof error.code === "string");
}

export function imageRouteError(error: unknown): NextResponse {
  if (hasHttpStatus(error)) {
    const code = error.code ?? error.message;
    return NextResponse.json({ error: code, code }, { status: error.status });
  }
  console.error("[admin vehicle images] request failed", error);
  return NextResponse.json({ error: "차량 이미지 처리 중 오류가 발생했습니다." }, { status: 500 });
}

export function invalidInput(details: unknown): NextResponse {
  return NextResponse.json({ error: "입력값이 올바르지 않습니다.", details }, { status: 400 });
}

type BodyParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly response: NextResponse };

export async function readJsonBody(request: Request): Promise<BodyParseResult<unknown>> {
  try {
    return { ok: true, value: await request.json() };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, response: invalidInput({ body: ["JSON 본문 형식이 올바르지 않습니다."] }) };
    }
    throw error;
  }
}

export async function readMultipartBody(request: Request): Promise<BodyParseResult<FormData>> {
  try {
    return { ok: true, value: await request.formData() };
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, response: invalidInput({ body: ["multipart 본문 형식이 올바르지 않습니다."] }) };
    }
    throw error;
  }
}
