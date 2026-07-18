// 신한카드(SHINHAN) 브랜드 코드 — carBrand 열거 국산 그룹 (2026-07 확인).
export interface ShinhanBrand {
  brandCd: string;
  name: string;
}

export const SHINHAN_BRANDS: ShinhanBrand[] = [
  { brandCd: "303", name: "현대" },
  { brandCd: "304", name: "제네시스" },
  { brandCd: "307", name: "기아" },
  { brandCd: "312", name: "쉐보레" },
  { brandCd: "321", name: "르노코리아" },
  { brandCd: "326", name: "KGM" },
];
