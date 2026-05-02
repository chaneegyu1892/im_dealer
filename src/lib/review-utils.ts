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
