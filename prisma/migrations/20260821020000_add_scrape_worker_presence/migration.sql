-- CreateTable
CREATE TABLE "ScrapeWorkerPresence" (
    "workerId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapeWorkerPresence_pkey" PRIMARY KEY ("workerId")
);
