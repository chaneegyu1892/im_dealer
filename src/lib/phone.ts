// 한국 휴대폰 번호를 채널톡이 요구하는 E.164 포맷(+82…)으로 변환한다.
// 입력 포맷이 섞여 있어(하이픈 유무 등) 숫자만 뽑아 정규화한다.
// 변환 불가한 값은 undefined 를 반환해 프로필에서 제외되도록 한다.
export function toE164KR(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return undefined;

  // 이미 국가코드(82)가 붙은 경우
  if (digits.startsWith("82")) {
    digits = digits.slice(2);
  }
  // 앞 0 제거 (010… → 10…)
  digits = digits.replace(/^0+/, "");

  // 국내 휴대폰 유효 자릿수(10~11자리, 앞자리 1x) 만 허용
  if (digits.length < 9 || digits.length > 11 || !digits.startsWith("1")) {
    return undefined;
  }
  return `+82${digits}`;
}
