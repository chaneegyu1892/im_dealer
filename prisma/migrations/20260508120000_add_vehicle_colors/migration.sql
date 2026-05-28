-- CreateEnum
CREATE TYPE "ColorKind" AS ENUM ('EXTERIOR', 'INTERIOR');

-- CreateTable
CREATE TABLE "VehicleColor" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "ColorKind" NOT NULL,
    "name" TEXT NOT NULL,
    "hexCode" TEXT NOT NULL,
    "imageUrl" TEXT,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleColor_vehicleId_kind_sortOrder_idx" ON "VehicleColor"("vehicleId", "kind", "sortOrder");

-- AlterTable
ALTER TABLE "SavedQuote" ADD COLUMN "exteriorColorId" TEXT;
ALTER TABLE "SavedQuote" ADD COLUMN "interiorColorId" TEXT;

-- CreateIndex
CREATE INDEX "SavedQuote_exteriorColorId_idx" ON "SavedQuote"("exteriorColorId");
CREATE INDEX "SavedQuote_interiorColorId_idx" ON "SavedQuote"("interiorColorId");

-- AddForeignKey
ALTER TABLE "VehicleColor" ADD CONSTRAINT "VehicleColor_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedQuote" ADD CONSTRAINT "SavedQuote_exteriorColorId_fkey" FOREIGN KEY ("exteriorColorId") REFERENCES "VehicleColor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SavedQuote" ADD CONSTRAINT "SavedQuote_interiorColorId_fkey" FOREIGN KEY ("interiorColorId") REFERENCES "VehicleColor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
