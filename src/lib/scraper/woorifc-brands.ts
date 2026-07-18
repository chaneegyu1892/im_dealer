// 우리금융캐피탈(WOORIFC) 브랜드 코드 — brandList_local 국산(kr) 그룹 (2026-07 확인).
// 카탈로그 수집 UI 브랜드 선택이 사용한다.
export interface WoorifcBrand {
  brandCd: string;
  name: string;
}

export const WOORIFC_BRANDS: WoorifcBrand[] = [
  { brandCd: "111", name: "현대" },
  { brandCd: "112", name: "제네시스" },
  { brandCd: "121", name: "기아" },
  { brandCd: "131", name: "쉐보레" },
  { brandCd: "132", name: "GMC" },
  { brandCd: "141", name: "KGM" },
  { brandCd: "151", name: "르노코리아" },
];
