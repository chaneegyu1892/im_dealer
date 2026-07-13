CREATE TYPE "VehicleImageOrigin" AS ENUM ('CARPAN2', 'ADMIN');

CREATE TYPE "VehicleImageStorageCleanupReason" AS ENUM (
  'UPLOAD_ROLLBACK',
  'IMAGE_PURGE',
  'VEHICLE_DELETE'
);

CREATE TYPE "VehicleImageStorageCleanupStatus" AS ENUM (
  'RESERVED',
  'READY',
  'PROCESSING',
  'DEAD'
);

ALTER TABLE "VehicleImage"
  ADD COLUMN "origin" "VehicleImageOrigin" NOT NULL DEFAULT 'CARPAN2',
  ADD COLUMN "adminStoragePath" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Vehicle"
  ADD COLUMN "thumbnailImageId" TEXT,
  ADD COLUMN "imageRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "VehicleImageStorageCleanup" (
  "id" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "reason" "VehicleImageStorageCleanupReason" NOT NULL,
  "status" "VehicleImageStorageCleanupStatus" NOT NULL DEFAULT 'RESERVED',
  "reservationToken" TEXT,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VehicleImageStorageCleanup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vehicle_thumbnailImageId_key" ON "Vehicle"("thumbnailImageId");
CREATE UNIQUE INDEX "VehicleImage_adminStoragePath_key" ON "VehicleImage"("adminStoragePath");
CREATE UNIQUE INDEX "VehicleImageStorageCleanup_storagePath_key" ON "VehicleImageStorageCleanup"("storagePath");
CREATE INDEX "VehicleImageStorageCleanup_status_availableAt_idx" ON "VehicleImageStorageCleanup"("status", "availableAt");
CREATE INDEX "VehicleImageStorageCleanup_leaseExpiresAt_idx" ON "VehicleImageStorageCleanup"("leaseExpiresAt");

ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_thumbnailImageId_fkey"
  FOREIGN KEY ("thumbnailImageId") REFERENCES "VehicleImage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
