import type { RateSheetRaw } from "@/types/admin";

/**
 * 캐피탈사 회수율 자동 수집 기능의 공유 타입.
 * 백엔드 API, 로컬 워커(scripts/scraper-worker), 관리자 UI 가 함께 사용한다.
 */

export type ScrapeJobStatus =
  | "pending"
  | "running"
  | "needs_human"
  | "completed"
  | "failed"
  | "canceled";

export type TrimMatchConfidence = "exact" | "fuzzy" | "unmatched";

/** 어드민이 작업 생성 시 넘기고, 워커가 수집 대상으로 사용하는 파라미터. */
export interface ScrapeJobParams {
  trimIds: string[];
  vehicleId: string;
  lineupIds: string[];
  weekOf: string; // "YYYY-MM-DD"
  minVehiclePrice: number;
  maxVehiclePrice: number;
  // 캐피탈사 차량 연결(차량 scraperRefs[캐피탈사]) + 트림명 — 워커 이름 자동매칭용
  scraperRef?: { brandCd: string; modelName: string };
  trims?: { trimId: string; name: string }[];
}

/**
 * 워커가 채워 ScrapeJob.draft 에 저장하는 초안.
 * 기존 저장 API(POST /api/admin/capital-rates) Body 및 RateInputForm state 와 1:1 로 매핑되어
 * 추가 변환 없이 그대로 검토-후-반영에 사용된다.
 */
export interface ScrapeDraft {
  scrapedAt: string; // ISO
  productType: string; // "장기렌트" | "리스"
  weekOf: string; // "YYYY-MM-DD"
  trims: Array<{
    trimId: string;
    matchConfidence: TrimMatchConfidence;
    externalTrimLabel: string; // 사이트 원본 라벨 (운영자 검증용)
    vehiclePrice: number;
    // 트림별 월 지불액(원) — 라인업별 그룹핑(라인업 자체 min/max 산출)용
    baseRates?: RateSheetRaw;
  }>;
  minVehiclePrice: number;
  maxVehiclePrice: number;
  // RATE_KEYS("36_10000" … "60_30000") 키, 값은 월 지불액(원). 0 = 미수집.
  minBaseRates: RateSheetRaw;
  minDepositRates: RateSheetRaw; // 36_10000 셀만 유효 (RateInputForm 규약)
  minPrepayRates: RateSheetRaw; // 36_10000 셀만 유효
  maxBaseRates: RateSheetRaw;
  maxDepositRates: RateSheetRaw;
  maxPrepayRates: RateSheetRaw;
  warnings: string[];
}

/** 워커 어댑터가 트림 1개를 수집해 반환하는 결과 (mapping.ts 가 ScrapeDraft 로 조립). */
export interface TrimScrapeResult {
  trimId: string;
  matchConfidence: TrimMatchConfidence;
  externalTrimLabel: string;
  vehiclePrice: number;
  baseRates: Partial<RateSheetRaw>; // RATE_KEYS → 원
  depositRate36_10000?: number;
  prepayRate36_10000?: number;
  warnings: string[];
}
