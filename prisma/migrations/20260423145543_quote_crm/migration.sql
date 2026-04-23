-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('NEW', 'CONTACTED', 'IN_PROGRESS', 'CONVERTED', 'LOST');

-- AlterTable
ALTER TABLE "SavedQuote" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "contactedAt" TIMESTAMP(3),
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "internalMemo" TEXT,
ADD COLUMN     "status" "QuoteStatus" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "QuoteActivityLog" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteActivityLog_quoteId_idx" ON "QuoteActivityLog"("quoteId");

-- CreateIndex
CREATE INDEX "SavedQuote_status_idx" ON "SavedQuote"("status");

-- CreateIndex
CREATE INDEX "SavedQuote_assigneeId_idx" ON "SavedQuote"("assigneeId");

-- CreateIndex
CREATE INDEX "SavedQuote_userId_idx" ON "SavedQuote"("userId");

-- AddForeignKey
ALTER TABLE "QuoteActivityLog" ADD CONSTRAINT "QuoteActivityLog_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SavedQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
