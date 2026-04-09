-- AlterTable
ALTER TABLE "TrimOption" ADD COLUMN     "description" TEXT,
ADD COLUMN     "isAccessory" BOOLEAN NOT NULL DEFAULT false;
