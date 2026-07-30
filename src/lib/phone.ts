// 한국 휴대폰 번호를 채널톡이 요구하는 E.164 포맷(+82…)으로 변환한다.
// 입력 포맷이 섞여 있어(하이픈 유무 등) 숫자만 뽑아 정규화한다.
// 변환 불가한 값은 undefined 를 반환해 프로필에서 제외되도록 한다.
export function toE164KR(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const compact = phone.trim().replace(/[\s-]/g, "");

  if (/^010\d{8}$/.test(compact)) {
    return `+82${compact.slice(1)}`;
  }
  if (/^\+?8210\d{8}$/.test(compact)) {
    return `+${compact.replace(/^\+/, "")}`;
  }
  return undefined;
}

// 저장·표시용 국내 하이픈 형식(010-1234-5678)으로 정규화한다.
// toE164KR 로 유효성을 검증하므로 형식이 잘못된 값은 undefined 를 반환한다.
export function toDomesticKR(phone: string | null | undefined): string | undefined {
  const e164 = toE164KR(phone);
  if (!e164) return undefined;
  const digits = `0${e164.slice(3)}`; // "+8210…" → "010…"
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}
