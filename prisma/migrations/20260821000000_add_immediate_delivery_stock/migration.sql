CREATE TABLE "ImmediateDeliveryBatch" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "vehicleCount" INTEGER NOT NULL,
    "warnings" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmediateDeliveryBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImmediateDeliveryBatch_brand_createdAt_idx" ON "ImmediateDeliveryBatch"("brand", "createdAt");

CREATE TABLE "ImmediateDeliveryStock" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "stockType" TEXT NOT NULL,
    "salesCode" TEXT,
    "trimName" TEXT NOT NULL,
    "optionText" TEXT,
    "exteriorColor" TEXT,
    "interiorColor" TEXT,
    "price" INTEGER,
    "discount" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmediateDeliveryStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImmediateDeliveryStock_batchId_idx" ON "ImmediateDeliveryStock"("batchId");
CREATE INDEX "ImmediateDeliveryStock_brand_model_idx" ON "ImmediateDeliveryStock"("brand", "model");
CREATE INDEX "ImmediateDeliveryStock_brand_stockType_idx" ON "ImmediateDeliveryStock"("brand", "stockType");

ALTER TABLE "ImmediateDeliveryStock" ADD CONSTRAINT "ImmediateDeliveryStock_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImmediateDeliveryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 관리자 전용 데이터. 서버(service_role)만 접근.
ALTER TABLE public."ImmediateDeliveryBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImmediateDeliveryStock" ENABLE ROW LEVEL SECURITY;
-- no policies (deny-all for non-bypass roles)
