export function maskAuthorName(realName: string): string {
  const first = realName.trim().charAt(0);
  return first ? `${first}○○님` : "익명님";
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  const first = digits.length === 11 ? digits.slice(0, 3) : digits.slice(0, digits.length - 4);
  const last4 = digits.slice(-4);
  return `${first}-****-${last4}`;
}

export function formatReviewDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}.${month}`;
}

/**
 * 후기 카드/모달용 차량 표기.
 * "더 뉴", "디 올 뉴", "The New" 등 마케팅 접두를 줄여 브랜드+모델이 잘리기 전에 읽히게 한다.
 */
export function formatReviewVehicleLabel(
  brand: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const b = (brand ?? "").trim();
  let n = (name ?? "").trim();
  if (!b && !n) return null;
  if (!n) return b || null;

  n = n
    .replace(/^(더\s*뉴|디\s*올\s*뉴|올\s*뉴|신형)\s*/i, "")
    .replace(/^(The\s+All\s+New|The\s+New|New|All\s+New)\s+/i, "")
    .replace(/\s+F\/L\b/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (b && n.toLowerCase().startsWith(b.toLowerCase())) {
    return n;
  }
  return b ? `${b} ${n}` : n;
}
