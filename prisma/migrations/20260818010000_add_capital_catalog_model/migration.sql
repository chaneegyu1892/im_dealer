-- 캐피탈사 브랜드별 차량(모델) 목록 — 트림 수집 없이 목록만 동기화해 수집 대상 선택에 쓴다.
CREATE TABLE "CapitalCatalogModel" (
    "id" TEXT NOT NULL,
    "financeCompanyId" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT '장기렌트',
    "brandCd" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "modelCd" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalCatalogModel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CapitalCatalogModel_fc_pt_brand_model_key"
ON "CapitalCatalogModel"("financeCompanyId", "productType", "brandCd", "modelCd");

CREATE INDEX "CapitalCatalogModel_fc_pt_brand_idx"
ON "CapitalCatalogModel"("financeCompanyId", "productType", "brandCd");

ALTER TABLE "CapitalCatalogModel"
ADD CONSTRAINT "CapitalCatalogModel_financeCompanyId_fkey"
FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
