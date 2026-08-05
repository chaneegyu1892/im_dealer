// 견적서 이미지 다운로드 파일명 — 회원 다운로드와 어드민 재발급이 공유한다.
// 고객 이름이 있으면 파일명 끝에 붙여 어드민이 파일만 보고도 수신 고객을 구분할 수 있게 한다.

export interface QuoteImageFilenameInput {
  vehicleName: string;
  /** 견적 레코드 구분자(어드민 재발급 전용). */
  idSuffix?: string;
  /** 있으면 파일명 마지막에 붙는다. 파일명에 쓸 수 없는 문자는 _ 로 치환. */
  customerName?: string | null;
  /** 날짜 스탬프 기준 시각 — 미지정 시 현재 시각. */
  date?: Date;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^\wㄱ-힣]/g, "_");
}

export function buildQuoteImageFilename(input: QuoteImageFilenameInput): string {
  const dateStamp = (input.date ?? new Date())
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const segments = ["아임딜러_견적서", sanitizeSegment(input.vehicleName), dateStamp];
  if (input.idSuffix) segments.push(input.idSuffix);

  const customerName = input.customerName?.trim() ?? "";
  if (/[\wㄱ-힣]/.test(customerName)) {
    segments.push(sanitizeSegment(customerName));
  }

  return `${segments.join("_")}.png`;
}
