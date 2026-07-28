/** 주민등록번호 원문을 보관하지 않고 생년월일 파생에 필요한 최소 자리만 사용한다. */
export function residentRegistrationBirthDate(front: string, backFirst: string): string {
  if (!/^\d{6}$/.test(front) || !/^[1-8]$/.test(backFirst)) return "";

  const yy = front.slice(0, 2);
  const mmdd = front.slice(2, 6);
  const century =
    backFirst === "1" || backFirst === "2" || backFirst === "5" || backFirst === "6"
      ? "19"
      : "20";
  return `${century}${yy}${mmdd}`;
}
