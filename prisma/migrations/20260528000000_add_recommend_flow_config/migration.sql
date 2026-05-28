CREATE TABLE "RecommendFlowConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "questions" JSONB NOT NULL,
    "scoring" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "RecommendFlowConfig_pkey" PRIMARY KEY ("id")
);
