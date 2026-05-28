-- QuoteCalcLog.rangeExceeded: 회수율 시트 범위 초과 견적 플래그
ALTER TABLE "QuoteCalcLog"
  ADD COLUMN "rangeExceeded" BOOLEAN NOT NULL DEFAULT false;

-- 어드민 위젯 집계 가속용 인덱스 (최근 N일 + 트림별 group by)
CREATE INDEX "QuoteCalcLog_rangeExceeded_createdAt_idx"
  ON "QuoteCalcLog"("rangeExceeded", "createdAt");
