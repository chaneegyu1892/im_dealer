-- AlterTable
ALTER TABLE "Review" ADD COLUMN "isBest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ReviewLike" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewLike_reviewId_anonId_key" ON "ReviewLike"("reviewId", "anonId");
CREATE INDEX "ReviewLike_reviewId_idx" ON "ReviewLike"("reviewId");
CREATE INDEX "ReviewLike_anonId_idx" ON "ReviewLike"("anonId");

-- CreateIndex
CREATE INDEX "Review_isPublic_isBest_displayOrder_idx" ON "Review"("isPublic", "isBest", "displayOrder");
CREATE INDEX "Review_isPublic_likeCount_idx" ON "Review"("isPublic", "likeCount");

-- AddForeignKey
ALTER TABLE "ReviewLike" ADD CONSTRAINT "ReviewLike_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
