-- AlterTable: QuoteCalcLog 차량명 스냅샷 컬럼 추가
ALTER TABLE "QuoteCalcLog"
  ADD COLUMN "vehicleName" TEXT;

-- 인기 차량 / 회원·비회원 분석을 위한 인덱스
CREATE INDEX "QuoteCalcLog_userId_idx" ON "QuoteCalcLog"("userId");
CREATE INDEX "QuoteCalcLog_vehicleId_createdAt_idx"
  ON "QuoteCalcLog"("vehicleId", "createdAt" DESC);
