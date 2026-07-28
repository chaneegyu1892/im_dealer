CREATE TABLE "RecommendationPopularitySnapshot" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "entries" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationPopularitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecommendationPopularitySnapshot_period_key"
ON "RecommendationPopularitySnapshot"("period");

CREATE INDEX "RecommendationPopularitySnapshot_fetchedAt_idx"
ON "RecommendationPopularitySnapshot"("fetchedAt");
