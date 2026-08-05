// 상품 유형(장기렌트 / 리스)의 저장값과 화면 표기를 분리한다.
//
// 저장값은 DB(CapitalRateSheet.productType 등)와 견적 스냅샷 JSON에 문자열 그대로
// 기록되므로 바꾸면 기존 데이터가 전부 어긋난다. 고객·어드민에게 보여주는 표기만
// 이 파일에서 매핑한다 — "리스" 저장값은 "운용리스"로 노출한다.

/** DB·API·스냅샷에 기록되는 상품 유형 저장값. 절대 변경 금지. */
export const PRODUCT_TYPE_VALUES = ["장기렌트", "리스"] as const;

export type ProductTypeValue = (typeof PRODUCT_TYPE_VALUES)[number];

const PRODUCT_TYPE_LABELS: Record<ProductTypeValue, string> = {
  장기렌트: "장기렌트",
  리스: "운용리스",
};

/** 화면·PDF·이미지 등 사용자에게 노출되는 상품 유형 표기. */
export function productTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  return PRODUCT_TYPE_LABELS[value as ProductTypeValue] ?? value;
}
