CREATE TYPE "VehicleImageType" AS ENUM (
  'MAIN',
  'COVER',
  'EXTERIOR_COLOR',
  'INTERIOR_COLOR',
  'SPEC_EXTERIOR',
  'SPEC_INTERIOR',
  'SPEC_SEAT',
  'SPEC_OPTION',
  'CATALOG_PAGE'
);

CREATE TABLE "VehicleImage" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "type" "VehicleImageType" NOT NULL,
  "title" TEXT,
  "storageUrl" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "sourceKey" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleImage_vehicleId_sourceKey_key" ON "VehicleImage"("vehicleId", "sourceKey");
CREATE INDEX "VehicleImage_vehicleId_type_isVisible_displayOrder_idx" ON "VehicleImage"("vehicleId", "type", "isVisible", "displayOrder");
CREATE INDEX "VehicleImage_sourceUrl_idx" ON "VehicleImage"("sourceUrl");

ALTER TABLE "VehicleImage"
  ADD CONSTRAINT "VehicleImage_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
