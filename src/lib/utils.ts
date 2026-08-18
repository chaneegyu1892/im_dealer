import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMonthly(amount: number): string {
  return `월 ${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

/** 300000 → "30만원"처럼 만원 단위로 줄인다. 만원 단위가 아니면 전체 표기로 되돌린다. */
export function formatWonShort(amount: number): string {
  if (amount >= 10_000 && amount % 10_000 === 0) return `${amount / 10_000}만원`;
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}
