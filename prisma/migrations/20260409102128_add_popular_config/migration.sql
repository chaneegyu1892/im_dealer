-- CreateTable
CREATE TABLE "PopularConfig" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopularConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopularConfigItem" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "trimOptionId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PopularConfigItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PopularConfig_vehicleId_idx" ON "PopularConfig"("vehicleId");

-- CreateIndex
CREATE INDEX "PopularConfigItem_configId_idx" ON "PopularConfigItem"("configId");

-- AddForeignKey
ALTER TABLE "PopularConfig" ADD CONSTRAINT "PopularConfig_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopularConfigItem" ADD CONSTRAINT "PopularConfigItem_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PopularConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PopularConfigItem" ADD CONSTRAINT "PopularConfigItem_trimOptionId_fkey" FOREIGN KEY ("trimOptionId") REFERENCES "TrimOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
