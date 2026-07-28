// 카카오톡 채널 관계 확인 — 카카오싱크로 채널을 추가한 회원인지 판별한다.
// 카카오 API: GET https://kapi.kakao.com/v1/api/talk/channels (Bearer = provider_token)
// 응답 예: { channels: [ { channel_uuid, encoded_id, relation: "ADDED"|"BLOCKED"|"NONE" } ] }
// ※ "채널 관계 확인" 권한(동의항목/스코프)이 필요하다 — 콘솔 설정 후 동작.

import { z } from "zod";

export type ChannelRelation = "ADDED" | "BLOCKED" | "NONE";

const channelResponseSchema = z.object({
  channels: z
    .array(
      z.object({
        channel_uuid: z.string().optional(),
        encoded_id: z.string().optional(),
        relation: z.string().optional(),
      })
    )
    .optional(),
});

/**
 * 카카오 채널 목록 응답에서 특정 채널과의 관계를 뽑아낸다(순수 함수).
 * channelId 는 channel_uuid 또는 encoded_id(_xxxxx) 어느 쪽이든 매칭한다.
 * 매칭 채널이 없으면(= 추가 안 함) "NONE".
 */
export function parseChannelRelation(json: unknown, channelId: string): ChannelRelation {
  const result = channelResponseSchema.safeParse(json);
  if (!result.success || !result.data.channels) return "NONE";

  const match = result.data.channels.find(
    (channel) =>
      channel.channel_uuid === channelId || channel.encoded_id === channelId
  );
  if (!match) return "NONE";

  const relation = typeof match.relation === "string" ? match.relation.toUpperCase() : "";
  if (relation === "ADDED" || relation === "BLOCKED") return relation;
  return "NONE";
}

/**
 * provider_token 으로 카카오 채널 관계를 조회한다.
 * 실패/미설정 시 "NONE" 반환(로그인 흐름을 막지 않는다).
 */
export async function getChannelRelation(
  providerToken: string,
  channelId: string
): Promise<ChannelRelation> {
  if (!providerToken || !channelId) return "NONE";
  try {
    const res = await fetch("https://kapi.kakao.com/v1/api/talk/channels", {
      headers: { Authorization: `Bearer ${providerToken}` },
    });
    if (!res.ok) return "NONE";
    return parseChannelRelation(await res.json(), channelId);
  } catch (error) {
    if (error instanceof Error) return "NONE";
    throw error;
  }
}
