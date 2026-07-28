-- Bound review-image uploads to a single capability token before storing any object.
ALTER TABLE "ReviewRequestToken"
ADD COLUMN "imageUploadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "imageUploadBytes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReviewImageUpload" (
    "id" TEXT NOT NULL,
    "reviewRequestTokenId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImageUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewImageUpload_path_key" ON "ReviewImageUpload"("path");
CREATE UNIQUE INDEX "ReviewImageUpload_url_key" ON "ReviewImageUpload"("url");
CREATE INDEX "ReviewImageUpload_reviewRequestTokenId_usedAt_idx" ON "ReviewImageUpload"("reviewRequestTokenId", "usedAt");

ALTER TABLE "ReviewImageUpload"
ADD CONSTRAINT "ReviewImageUpload_reviewRequestTokenId_fkey"
FOREIGN KEY ("reviewRequestTokenId") REFERENCES "ReviewRequestToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
