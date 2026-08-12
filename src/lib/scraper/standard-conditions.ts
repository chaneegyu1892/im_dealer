// 렌트/리스 견적 수집 표준 조건 SSOT — 2026-07-24 서비스 오픈 준비 회의(15번) 결정.
// - 국산차: 항상 '특판' — 금융사가 제조사에 직접 대량 발주(중간 마진 없음), 월납입금 약 4만원 저렴.
// - 수입차: 항상 '비제휴' — 금융사 특판 미운영, 할인 정책 복잡·딜러사 경유.
// - 리스 종류: '운용리스' 기본 (주력 상품).
// - 일부 리스 상품(메리츠 등)은 잔가율이 자동 세팅되지 않아 수동 입력 필요 — 값이 틀리면 견적 미산출.
// 신규 캐피탈사 어댑터·엑셀 파서는 이 조건을 기본값으로 사용한다.

export type BrandOrigin = "domestic" | "imported";
export type ShipmentMode = "특판" | "비제휴";

/** 리스 상품 기본 종류. */
export const DEFAULT_LEASE_TYPE = "운용리스" as const;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

// 국내 출고망(특판 채널) 브랜드 — 표기 이형 포함. GMC·대창모터스는 국내 딜러망 유통이라 특판 채널로 취급(ORIX 등록 기준).
const DOMESTIC_BRANDS = [
  "현대", "기아", "제네시스", "쉐보레", "GM", "지엠", "KG", "KGM", "쌍용", "케이지",
  "르노", "르노코리아", "GMC", "대창모터스",
].map(norm);

const IMPORTED_BRANDS = [
  "벤츠", "메르세데스", "BMW", "아우디", "폭스바겐", "볼보", "포르쉐", "미니", "테슬라", "BYD",
  "렉서스", "토요타", "혼다", "닛산", "인피니티", "포드", "지프", "캐딜락", "링컨",
  "푸조", "랜드로버", "재규어", "마세라티", "폴스타",
].map(norm);

/** 브랜드명 → 국산/수입 판별. 미등록 브랜드는 null — 호출측에서 경고 후 명시적으로 결정한다. */
export function brandOrigin(brandName: string): BrandOrigin | null {
  const n = norm(brandName);
  if (!n) return null;
  if (DOMESTIC_BRANDS.some((b) => n.includes(b))) return "domestic";
  if (IMPORTED_BRANDS.some((b) => n.includes(b))) return "imported";
  return null;
}

/** 회의 결정: 국산=특판, 수입=비제휴. */
export function shipmentModeFor(origin: BrandOrigin): ShipmentMode {
  return origin === "domestic" ? "특판" : "비제휴";
}
