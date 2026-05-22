-- CapitalRateSheet.productType: 장기렌트 / 리스 분리
ALTER TABLE "CapitalRateSheet" ADD COLUMN "productType" TEXT NOT NULL DEFAULT '장기렌트';

-- 기존 unique 인덱스 제거 후 productType 포함하여 재생성
DROP INDEX "CapitalRateSheet_financeCompanyId_trimId_weekOf_key";

CREATE UNIQUE INDEX "CapitalRateSheet_financeCompanyId_trimId_weekOf_productType_key"
  ON "CapitalRateSheet"("financeCompanyId", "trimId", "weekOf", "productType");
