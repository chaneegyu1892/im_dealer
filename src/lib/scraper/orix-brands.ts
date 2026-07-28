// ORIX 캐피탈 브랜드 코드 — ORIX 견적 페이지(sit0001)에 등록된 전 브랜드 (2026-07 확인).
// 잡 생성(자동 인식)·카탈로그 수집 UI 브랜드 선택이 공유한다.
export interface OrixBrand {
  brandCd: string;
  name: string;
}

export const ORIX_BRANDS: OrixBrand[] = [
  { brandCd: "CA100001", name: "현대" },
  { brandCd: "CA100088", name: "제네시스" },
  { brandCd: "CA100002", name: "기아" },
  { brandCd: "CA100045", name: "쉐보레" },
  { brandCd: "CA100004", name: "르노코리아" },
  { brandCd: "CA100060", name: "GMC" },
  { brandCd: "CA100005", name: "KGM" },
  { brandCd: "CA100095", name: "대창모터스" },
];

// 우리 브랜드명 → ORIX 브랜드코드 (trim_rates 잡의 차량 자동 인식용, 표기 이형 포함)
export const ORIX_BRAND_CD: Record<string, string> = {
  "현대": "CA100001",
  "기아": "CA100002",
  "제네시스": "CA100088",
  "쉐보레": "CA100045",
  "르노": "CA100004",
  "르노코리아": "CA100004",
  "KGM": "CA100005",
  "GMC": "CA100060",
  "대창모터스": "CA100095",
};
