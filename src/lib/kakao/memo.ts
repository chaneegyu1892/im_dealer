import { z } from "zod";

const MEMO_ENDPOINT = "https://kapi.kakao.com/v2/api/talk/memo/scrap/send";

export interface QuoteMemoParams {
  readonly accessToken: string;
  readonly linkUrl: string;
}

export interface MemoSendResult {
  readonly ok: boolean;
  /** 실패 사유(로그·DB 기록용). 성공 시 null. */
  readonly reason: string | null;
}

const memoResponseSchema = z.object({
  result_code: z.number().int(),
  msg: z.string().optional(),
});

export async function sendQuoteMemo(params: QuoteMemoParams): Promise<MemoSendResult> {
  try {
    const res = await fetch(MEMO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        request_url: params.linkUrl,
      }),
    });

    if (!res.ok) {
      // 카카오는 실패 사유를 본문에 담아준다(스코프 미동의, 토큰 만료 등).
      const detail = await readResponseText(res);
      return { ok: false, reason: `HTTP ${res.status} ${detail}`.trim() };
    }

    const payload: unknown = await res.json();
    const parsed = memoResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, reason: "카카오 응답 형식을 확인할 수 없습니다." };
    }
    if (parsed.data.result_code !== 0) {
      const message = parsed.data.msg ? ` ${parsed.data.msg}` : "";
      return {
        ok: false,
        reason: `result_code=${parsed.data.result_code}${message}`,
      };
    }

    return { ok: true, reason: null };
  } catch (error) {
    if (error instanceof Error) {
      return { ok: false, reason: error.message };
    }
    throw error;
  }
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    if (error instanceof Error) return "";
    throw error;
  }
}
