// 알림톡 템플릿 정의. **검수 승인된 템플릿과 본문이 글자 단위로 일치해야** 발송이 성공한다
// (불일치 시 resultCode 3016/3027/3028, 재시도해도 무의미). 그래서 본문·버튼을 한 파일에
// 모아 단일 소스로 관리하고, 비즈톡센터에 등록할 원문(`draft`)도 함께 둔다.
//
// 등록 원문의 `#{변수}` 자리에 값을 채운 결과가 buildMessage 의 반환값이어야 한다.

import type { AlimtalkButton } from "./types";

export type AlimtalkTemplateKey = "QUOTE_DELIVERED";

/** 비즈톡센터에 등록할 원문. 검수 접수 시 이 문자열을 그대로 붙여넣는다. */
export const QUOTE_DELIVERED_DRAFT = `[아임딜러] 견적서 도착 안내

#{고객명}님, 요청하신 견적서가 준비되었습니다.

■ 차량: #{차량명} #{트림명}
■ 상품: #{상품유형} · #{계약기간}개월 · 연 #{약정거리}km
■ 월 납입금: #{월납입금}원 (#{금융사} 기준)

아래 버튼에서 견적서 전체 내용을 확인하실 수 있습니다.

※ 본 메시지는 견적서 발송을 요청하신 고객님께 발송되는 안내입니다.`;

export interface QuoteDeliveredVars {
  고객명: string;
  차량명: string;
  트림명: string;
  상품유형: string;
  계약기간: number;
  약정거리: number;
  월납입금: number;
  금융사: string;
  /** 버튼 링크. 프로토콜(https://)까지 포함된 완성 URL 이어야 한다. */
  링크: string;
}

const won = (n: number) => Math.round(n).toLocaleString("ko-KR");

export function buildQuoteDeliveredMessage(v: QuoteDeliveredVars): string {
  return `[아임딜러] 견적서 도착 안내

${v.고객명}님, 요청하신 견적서가 준비되었습니다.

■ 차량: ${v.차량명} ${v.트림명}
■ 상품: ${v.상품유형} · ${v.계약기간}개월 · 연 ${won(v.약정거리)}km
■ 월 납입금: ${won(v.월납입금)}원 (${v.금융사} 기준)

아래 버튼에서 견적서 전체 내용을 확인하실 수 있습니다.

※ 본 메시지는 견적서 발송을 요청하신 고객님께 발송되는 안내입니다.`;
}

export function buildQuoteDeliveredButtons(linkUrl: string): AlimtalkButton[] {
  return [{ name: "견적서 확인하기", type: "WL", url_mobile: linkUrl, url_pc: linkUrl }];
}

/**
 * 검수 승인 후 부여받은 tmpltCode. 미설정이면 발송을 시도하지 않는다.
 * 코드가 없는 채로 보내면 resultCode 3015(템플릿 없음)로 과금 없이 실패하지만,
 * 큐에 실패 행만 쌓이므로 애초에 적재하지 않는 편이 낫다.
 */
export function getTemplateCode(key: AlimtalkTemplateKey): string | null {
  const code = process.env[`ALIMTALK_TEMPLATE_${key}`]?.trim();
  return code ? code : null;
}
