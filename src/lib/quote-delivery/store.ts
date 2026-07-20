// 견적서 PNG 를 Storage 에 올리고 카카오가 읽을 수 있는 URL 을 돌려준다.
//
// 카카오 메시지의 이미지는 카카오 서버가 직접 가져가므로 인증 없이 접근 가능한 URL 이어야 한다.
// 서명 URL 은 만료가 있어 메시지가 나중에 깨지므로, 이미지는 공개 버킷을 쓰고
// 대신 경로에 UUID 를 넣어 추측 불가능하게 한다(견적서엔 이름·연락처가 없다).

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { QUOTE_IMAGE_BUCKET } from "@/lib/quote-delivery/public-url";

export class QuoteStorageError extends Error {
  readonly name = "QuoteStorageError";
  constructor(operation: "UPLOAD" | "DELETE", message: string) {
    super(`QUOTE_STORAGE_${operation}_FAILED: ${message}`);
  }
}

export async function uploadQuoteImage(params: {
  png: Uint8Array;
}): Promise<{ path: string }> {
  const path = `deliveries/${randomUUID()}.png`;

  const { error } = await supabaseAdmin()
    .storage.from(QUOTE_IMAGE_BUCKET)
    .upload(path, params.png, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw new QuoteStorageError("UPLOAD", error.message);

  return { path };
}

export async function deleteQuoteImage(path: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .storage.from(QUOTE_IMAGE_BUCKET)
    .remove([path]);

  if (error) throw new QuoteStorageError("DELETE", error.message);
}
