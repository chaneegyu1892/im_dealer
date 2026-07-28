ALTER TABLE "VehicleImage"
ADD COLUMN "listThumbnailUrl" TEXT,
ADD COLUMN "listThumbnailStoragePath" TEXT;

CREATE INDEX "VehicleImage_listThumbnailStoragePath_idx"
ON "VehicleImage"("listThumbnailStoragePath");
