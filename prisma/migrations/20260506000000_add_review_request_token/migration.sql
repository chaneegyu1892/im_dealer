-- CreateTable
CREATE TABLE "ReviewRequestToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "savedQuoteId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ReviewRequestToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequestToken_token_key" ON "ReviewRequestToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequestToken_reviewId_key" ON "ReviewRequestToken"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewRequestToken_savedQuoteId_idx" ON "ReviewRequestToken"("savedQuoteId");

-- CreateIndex
CREATE INDEX "ReviewRequestToken_expiresAt_idx" ON "ReviewRequestToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "ReviewRequestToken" ADD CONSTRAINT "ReviewRequestToken_savedQuoteId_fkey" FOREIGN KEY ("savedQuoteId") REFERENCES "SavedQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequestToken" ADD CONSTRAINT "ReviewRequestToken_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
