-- 엑셀 수집(메리츠/MG) 잔가율 보존 — 기간×거리별 잔가율을 카탈로그에 저장해 검증·재계산 가능하게 함
ALTER TABLE "CapitalCatalogTrim" ADD COLUMN "residualRates" JSONB;
