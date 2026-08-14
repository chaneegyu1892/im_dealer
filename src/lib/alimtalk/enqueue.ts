// 알림톡 발송 요청을 큐(AlimtalkMessage)에 적재한다.
// 실제 발송은 고정 IP 릴레이(scripts/biztalk-relay)가 클레임해서 수행한다.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptString } from "@/lib/pii";
import { toE164KR } from "@/lib/phone";
import type { AlimtalkButton } from "./types";
import type { AlimtalkTemplateKey } from "./templates";
import { getTemplateCode } from "./templates";

export function isAlimtalkEnabled(): boolean {
  return process.env.ALIMTALK_ENABLED === "true";
}

/** 비즈톡 recipient 포맷(01012345678). 유효하지 않으면 null. */
export function toAlimtalkRecipient(phone: string | null | undefined): string | null {
  const e164 = toE164KR(phone);
  return e164 ? `0${e164.slice(3)}` : null;
}

export interface EnqueueAlimtalkInput {
  templateKey: AlimtalkTemplateKey;
  phone: string | null | undefined;
  message: string;
  buttons?: AlimtalkButton[];
  userId?: string;
  refType?: string;
  refId?: string;
}

export type EnqueueAlimtalkResult =
  | { ok: true; id: string }
  | { ok: false; reason: "disabled" | "no_template_code" | "invalid_phone" };

/**
 * 발송 실패가 호출부(견적서 전송 등)를 막으면 안 되므로 예외를 던지지 않고
 * 이유를 돌려준다. 호출부는 로그만 남기고 자기 흐름을 계속하면 된다.
 */
export async function enqueueAlimtalk(
  input: EnqueueAlimtalkInput
): Promise<EnqueueAlimtalkResult> {
  if (!isAlimtalkEnabled()) return { ok: false, reason: "disabled" };

  const templateCode = getTemplateCode(input.templateKey);
  if (!templateCode) return { ok: false, reason: "no_template_code" };

  const recipient = toAlimtalkRecipient(input.phone);
  if (!recipient) return { ok: false, reason: "invalid_phone" };

  const row = await prisma.alimtalkMessage.create({
    data: {
      templateKey: input.templateKey,
      templateCode,
      recipient: encryptString(recipient) ?? recipient,
      message: input.message,
      buttons: input.buttons?.length
        ? (input.buttons as unknown as Prisma.InputJsonValue)
        : undefined,
      userId: input.userId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    },
    select: { id: true },
  });

  return { ok: true, id: row.id };
}
