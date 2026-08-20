// 즉시출고 재고 엑셀 파서 공통 타입 — 브랜드별 양식을 하나의 정규화 행으로 수렴한다.

export const IMMEDIATE_DELIVERY_BRANDS = ["기아", "현대", "르노"] as const;
export type ImmediateDeliveryBrand = (typeof IMMEDIATE_DELIVERY_BRANDS)[number];

export type ImmediateStockType = "NORMAL" | "LIMITED"; // 정상 | 한정(조건)

export interface ImmediateStockRow {
  model: string; // 시트명 기반 모델명 (카니발, 싼타페, 그랑콜레오스 등)
  stockType: ImmediateStockType;
  salesCode?: string; // 판매코드 (르노는 모델코드)
  trimName: string; // 차종 상세
  optionText?: string;
  exteriorColor?: string;
  interiorColor?: string;
  price?: number; // 원. 르노 양식에는 가격이 없어 undefined
  discount?: number; // 판매조건계(원). 르노는 시트명의 한정액
  quantity: number; // 기아·현대 한정 시트는 1행 = 1대
  location?: string; // 출하지/출고센터
  extra?: Record<string, unknown>; // 브랜드 특화 필드 (생산번호, 생산일, 조건 세부 등)
}

export interface ParsedImmediateStock {
  brand: ImmediateDeliveryBrand;
  rows: ImmediateStockRow[];
  warnings: string[]; // 해석하지 못한 시트/헤더 등
  skippedSheets: string[]; // "재고없음" 등 데이터 없는 시트
}
