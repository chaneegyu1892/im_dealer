-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN "financeCompanyId" TEXT,
ADD COLUMN "immediateDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "selectedOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_financeCompanyId_fkey" FOREIGN KEY ("financeCompanyId") REFERENCES "FinanceCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Inventory_financeCompanyId_idx" ON "Inventory"("financeCompanyId");
